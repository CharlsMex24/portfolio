"""Convert a MuJoCo Menagerie robot (MJCF + OBJ visual meshes) into one GLB for three.js.

Usage:  python mjcf_to_glb.py <robot.xml> <out.glb>
        then: npx -y gltfpack@1.2.0 -i out.glb -o small.glb -si 0.5 -kn -km -cc

One glTF node per MuJoCo body, same names, local transforms copied from the MJCF, so a page can
rotate each body about its joint axis. Visual geoms of a body are merged per material, with each
geom's own pos/quat applied. Corners that share position and (rounded) normal are welded, so the
simplifier can work on smooth areas while hard edges keep their split normals.
"""
import json
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

XML = Path(sys.argv[1])
OUT = Path(sys.argv[2])
MESHDIR = XML.parent / (ET.parse(XML).getroot().find("compiler").get("meshdir", "") or "")


def read_obj(path):
    vs, vns, out_p, out_n = [], [], [], []
    for line in path.read_text().splitlines():
        if line.startswith("v "):
            vs.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vn "):
            vns.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("f "):
            idx = [c.split("/") for c in line.split()[1:]]
            for k in range(1, len(idx) - 1):  # fan triangulation
                for c in (idx[0], idx[k], idx[k + 1]):
                    out_p.append(vs[int(c[0]) - 1])
                    out_n.append(vns[int(c[2]) - 1] if len(c) > 2 and c[2] else [0, 0, 1])
    return np.array(out_p, np.float32), np.array(out_n, np.float32)


def quat_wxyz(attr):
    w, x, y, z = (float(v) for v in attr.split())
    q = np.array([w, x, y, z], np.float64)
    return q / np.linalg.norm(q)


def rotmat(q):
    w, x, y, z = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ], np.float32)


root = ET.parse(XML).getroot()
materials = {m.get("name"): [float(v) for v in m.get("rgba").split()] for m in root.find("asset").iter("material")}
mesh_files = {(m.get("name") or Path(m.get("file")).stem): m.get("file") for m in root.find("asset").iter("mesh")}
mat_names = list(materials)
nodes, meshes, accessors, views, blobs = [], [], [], [], []
offset = 0


def add_view(data, target):
    global offset
    b = data.tobytes()
    pad = (-len(b)) % 4
    blobs.append(b + b"\0" * pad)
    views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(b), "target": target})
    offset += len(b) + pad
    return len(views) - 1


def add_accessor(arr, kind, target, comp):
    acc = {"bufferView": add_view(arr, target), "componentType": comp, "count": int(arr.shape[0]), "type": kind}
    if kind == "VEC3":
        acc["min"] = arr.min(0).tolist()
        acc["max"] = arr.max(0).tolist()
    accessors.append(acc)
    return len(accessors) - 1


def build(body):
    by_mat = {}
    for g in body.findall("geom"):
        if g.get("class") != "visual" or not g.get("mesh"):
            continue
        p, n = read_obj(MESHDIR / mesh_files[g.get("mesh")])
        if g.get("quat"):
            R = rotmat(quat_wxyz(g.get("quat")))
            p, n = p @ R.T, n @ R.T
        if g.get("pos"):
            p = p + np.array([float(v) for v in g.get("pos").split()], np.float32)
        by_mat.setdefault(g.get("material"), []).append((p, n))

    node = {"name": body.get("name")}
    if body.get("pos"):
        node["translation"] = [float(v) for v in body.get("pos").split()]
    if body.get("quat"):
        w, x, y, z = quat_wxyz(body.get("quat"))
        node["rotation"] = [x, y, z, w]
    if by_mat:
        prims = []
        for mat, geoms in by_mat.items():
            p = np.concatenate([x[0] for x in geoms])
            n = np.concatenate([x[1] for x in geoms])
            key = np.concatenate([np.round(p * 1e5), np.round(n * 8)], axis=1)
            _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
            p, n = p[first], n[first]
            prims.append({
                "attributes": {"POSITION": add_accessor(p, "VEC3", 34962, 5126),
                               "NORMAL": add_accessor(n, "VEC3", 34962, 5126)},
                "indices": add_accessor(inverse.reshape(-1).astype(np.uint32), "SCALAR", 34963, 5125),
                "material": mat_names.index(mat),
            })
        meshes.append({"name": body.get("name"), "primitives": prims})
        node["mesh"] = len(meshes) - 1
    nodes.append(node)
    me = len(nodes) - 1
    kids = [build(c) for c in body.findall("body")]
    if kids:
        nodes[me]["children"] = kids
    return me


tops = [build(b) for b in root.find("worldbody").findall("body")]
gltf = {
    "asset": {"version": "2.0", "generator": f"mjcf_to_glb.py ({XML.name}, MuJoCo Menagerie)"},
    "scene": 0,
    "scenes": [{"nodes": tops}],
    "nodes": nodes,
    "meshes": meshes,
    "materials": [{"name": k, "pbrMetallicRoughness": {"baseColorFactor": v, "metallicFactor": 0, "roughnessFactor": 0.5}}
                  for k, v in materials.items()],
    "accessors": accessors,
    "bufferViews": views,
    "buffers": [{"byteLength": offset}],
}
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * ((-len(js)) % 4)
bin_ = b"".join(blobs)
with open(OUT, "wb") as f:
    f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
    f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
    f.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)
tris = sum(a["count"] for a in accessors if a["type"] == "SCALAR") // 3
print(f"{OUT.name}: {OUT.stat().st_size / 1e6:.1f} MB, {len(nodes)} nodes, {tris:,} triangles, bodies: {[n['name'] for n in nodes]}")

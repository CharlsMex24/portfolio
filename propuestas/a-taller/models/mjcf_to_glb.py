"""Convert the MuJoCo Menagerie Franka Panda (panda.xml + OBJ visuals) into one GLB.

One glTF node per MuJoCo body, same names (link0..link7, hand, left_finger, right_finger),
local transforms copied from the MJCF, so the page can rotate each link about its local Z.
Geoms that share a body and a material are merged into one primitive.
"""
import json
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

SRC = Path(__file__).parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC / "panda_raw.glb"


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


def quat_xyzw(attr):
    if not attr:
        return None
    w, x, y, z = (float(v) for v in attr.split())
    q = np.array([x, y, z, w], np.float64)
    return (q / np.linalg.norm(q)).tolist()


root = ET.parse(SRC / "panda.xml").getroot()
materials = {m.get("name"): [float(v) for v in m.get("rgba").split()]
             for m in root.find("asset").iter("material")}
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
    view = add_view(arr, target)
    acc = {"bufferView": view, "componentType": comp, "count": int(arr.shape[0]), "type": kind}
    if kind == "VEC3" and comp == 5126:
        acc["min"] = arr.min(0).tolist()
        acc["max"] = arr.max(0).tolist()
    accessors.append(acc)
    return len(accessors) - 1


def build(body):
    by_mat = {}
    for g in body.findall("geom"):
        if g.get("class") != "visual":
            continue
        p, n = read_obj(SRC / "assets" / f"{g.get('mesh')}.obj")
        by_mat.setdefault(g.get("material"), []).append((p, n))

    node = {"name": body.get("name")}
    if body.get("pos"):
        node["translation"] = [float(v) for v in body.get("pos").split()]
    q = quat_xyzw(body.get("quat"))
    if q:
        node["rotation"] = q
    joint = body.find("joint")
    if joint is not None:
        node["extras"] = {"joint": joint.get("name")}

    if by_mat:
        prims = []
        for mat, parts in by_mat.items():
            p = np.concatenate([x[0] for x in parts])
            n = np.concatenate([x[1] for x in parts])
            # The OBJs repeat every corner once per face. Weld corners whose position and
            # (rounded) normal match, so smooth areas share vertices and the simplifier can work;
            # real hard edges keep their split normals.
            key = np.concatenate([np.round(p * 1e5), np.round(n * 8)], axis=1)
            _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
            p, n = p[first], n[first]
            idx = inverse.reshape(-1).astype(np.uint32)
            prims.append({
                "attributes": {"POSITION": add_accessor(p, "VEC3", 34962, 5126),
                               "NORMAL": add_accessor(n, "VEC3", 34962, 5126)},
                "indices": add_accessor(idx, "SCALAR", 34963, 5125),
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


top = build(root.find("worldbody").find("body"))

gltf = {
    "asset": {"version": "2.0", "generator": "mjcf_to_glb.py (MuJoCo Menagerie Franka Panda, Apache-2.0)"},
    "scene": 0,
    "scenes": [{"nodes": [top]}],
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
print(f"{OUT.name}: {OUT.stat().st_size/1e6:.1f} MB, {len(nodes)} nodes, {tris:,} triangles")
assert [n["name"] for n in nodes][:3] == ["link0", "link1", "link2"], "hierarchy order changed"

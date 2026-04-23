/* ── PARTICLE CANVAS ────────────────────────────────────────────────── */
(function(){
    const canvas = document.getElementById('hero-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let W,H,particles,mouse={x:-9999,y:-9999};

    /* Hint: hide once the user interacts or after 10s */
    const hint = document.getElementById('netHint');
    function hideHint(){ if(hint && !hint.classList.contains('is-hidden')) hint.classList.add('is-hidden'); }
    if (hint) {
        const hero = document.getElementById('home');
        if (hero) {
            hero.addEventListener('mousemove', hideHint, { once: true });
            hero.addEventListener('touchstart', hideHint, { once: true, passive: true });
        }
        setTimeout(hideHint, 10000);
    }
    const COLORS=['rgba(139,92,246,','rgba(59,130,246,','rgba(34,211,238,','rgba(99,102,241,'];
    const N=180, CONNECT=175, MOUSE_R=130;
    function resize(){
        const rect = canvas.parentElement.getBoundingClientRect();
        W=canvas.width=canvas.offsetWidth||window.innerWidth;
        H=canvas.height=canvas.offsetHeight||window.innerHeight;
    }
    function mk(){ const c=COLORS[Math.floor(Math.random()*COLORS.length)]; return {x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.75,vy:(Math.random()-.5)*.75,r:Math.random()*2+.9,c}; }
    function init(){ resize(); particles=Array.from({length:N},mk); }
    function draw(){
        ctx.clearRect(0,0,W,H);
        particles.forEach(p=>{
            const dx=p.x-mouse.x,dy=p.y-mouse.y,d=Math.sqrt(dx*dx+dy*dy);
            if(d<MOUSE_R){ const f=(MOUSE_R-d)/MOUSE_R*.016; p.vx+=dx*f; p.vy+=dy*f; }
            p.vx*=.995; p.vy*=.995; p.x+=p.vx; p.y+=p.vy;
            if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
        });
        for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++){
            const a=particles[i],b=particles[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);
            if(d<CONNECT){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.strokeStyle=a.c+(1-d/CONNECT)*.85+')'; ctx.lineWidth=1.3; ctx.stroke(); }
        }
        particles.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.c+'.8)'; ctx.shadowBlur=7; ctx.shadowColor=p.c+'.5)'; ctx.fill(); ctx.shadowBlur=0; });
        requestAnimationFrame(draw);
    }
    window.addEventListener('resize',resize);
    const hero=document.getElementById('home');
    hero.addEventListener('mousemove',e=>{ const r=canvas.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; });
    hero.addEventListener('mouseleave',()=>{ mouse.x=-9999; mouse.y=-9999; });
    init(); draw();
})();

/* ── WINDOW CARDS FLY-IN ────────────────────────────────────────────── */
(function(){
    const delays = {winShell:900, winCode:1150, winExo:1420};
    Object.entries(delays).forEach(([id,ms])=>{
        const el=document.getElementById(id);
        if(!el) return;
        setTimeout(()=>el.classList.add('win-in'), ms);
    });
})();

/* ── WORD SPLIT REVEAL on section titles ────────────────────────────── */
(function(){
    function splitWords(el){
        const html = el.innerHTML;
        // wrap each text node word in spans, preserve HTML tags
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while(node = walker.nextNode()) textNodes.push(node);
        textNodes.forEach(tn=>{
            const words = tn.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            words.forEach(w=>{
                if(/^\s+$/.test(w)){ frag.appendChild(document.createTextNode(w)); return; }
                if(!w) return;
                const wrap = document.createElement('span');
                wrap.className='word-wrap';
                const inner = document.createElement('span');
                inner.className='word-inner';
                inner.textContent=w;
                wrap.appendChild(inner);
                frag.appendChild(wrap);
            });
            tn.parentNode.replaceChild(frag,tn);
        });
    }

    const titleObs = new IntersectionObserver(entries=>{
        entries.forEach(e=>{
            if(!e.isIntersecting) return;
            const inners = e.target.querySelectorAll('.word-inner');
            inners.forEach((w,i)=>setTimeout(()=>w.classList.add('word-in'), i*60));
            titleObs.unobserve(e.target);
        });
    },{threshold:.3});

    document.querySelectorAll('.s-title').forEach(el=>{
        splitWords(el);
        titleObs.observe(el);
    });
})();


 
/* SCROLL PROGRESS */
window.addEventListener('scroll',()=>{
    document.getElementById('spbar').style.width=(window.scrollY/(document.body.scrollHeight-window.innerHeight)*100)+'%';
});
 
/* NAV TOGGLE */
function toggleNav(){document.getElementById('navLinks').classList.toggle('open');}
function closeNav(){document.getElementById('navLinks').classList.remove('open');}
 
/* TYPEWRITER */
const phrases=['Mechatronics Engineering','AI & Robotics','Chairless Chair Builder','Energy Systems'];
let pi=0,ci=0,del=false;
const tw=document.getElementById('tw');
function type(){
    const w=phrases[pi];
    if(!del){tw.textContent=w.slice(0,++ci);if(ci===w.length){del=true;setTimeout(type,1900);return;}}
    else    {tw.textContent=w.slice(0,--ci);if(ci===0){del=false;pi=(pi+1)%phrases.length;}}
    setTimeout(type,del?50:95);
}
setTimeout(type,1400);
 
/* COUNTER */
function animCount(el){
    const t=parseInt(el.dataset.count); if(isNaN(t))return;
    let c=0; const step=Math.ceil(t/60);
    (function tick(){c=Math.min(c+step,t);el.textContent=c;if(c<t)requestAnimationFrame(tick);})();
}
 
/* SCROLL REVEAL */
const ro=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
        if(e.isIntersecting){
            e.target.classList.add('visible');
            e.target.querySelectorAll('[data-count]').forEach(animCount);
            e.target.querySelectorAll('.wip-fill').forEach(b=>{b.style.width=b.dataset.pct+'%';});
        }
    });
},{threshold:.1,rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
 
/* Hero stats counter on visible */
const heroObs=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting) entries[0].target.querySelectorAll('[data-count]').forEach(animCount);
},{threshold:.5});
document.querySelectorAll('.hero-stats').forEach(el=>heroObs.observe(el));
 
/* PORTFOLIO FILTER */
document.querySelectorAll('.flt').forEach(btn=>{
    btn.addEventListener('click',()=>{
        document.querySelectorAll('.flt').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const f=btn.dataset.f;
        document.querySelectorAll('.pcard').forEach(c=>{c.style.display=(f==='all'||c.dataset.cat===f)?'':'none';});
    });
});
 
/* 3D TILT */
document.querySelectorAll('.pcard').forEach(card=>{
    card.addEventListener('mousemove',e=>{
        const r=card.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
        card.style.transform=`translateY(-8px) rotateX(${-y*5}deg) rotateY(${x*5}deg)`;
    });
    card.addEventListener('mouseleave',()=>card.style.transform='');
});

/* CERT MODAL */
function openModal(src,cap){
    if (window.event) event.preventDefault();
    const box=document.getElementById('modalBox');
    const cnt=document.getElementById('modalContent');
    const isPdf=src.endsWith('.pdf');
    box.style.maxWidth=isPdf?'960px':'860px';
    cnt.innerHTML=isPdf
        ?`<iframe src="${src}" style="width:100%;height:80vh;border:none;display:block;border-radius:12px 12px 0 0;"></iframe>`
        :`<img src="${src}" alt="${cap}" style="width:100%;display:block;max-height:80vh;object-fit:contain;background:#000;border-radius:12px 12px 0 0;">`;
    document.getElementById('modalCap').textContent=cap;
    document.getElementById('certModal').classList.add('open');
    document.body.style.overflow='hidden';
}
function closeModal(){
    document.getElementById('certModal').classList.remove('open');
    document.getElementById('modalContent').innerHTML='';
    document.body.style.overflow='';
}
document.getElementById('certModal').addEventListener('click',e=>{if(e.target.id==='certModal')closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* CHATBOT */
(function(){
    var KB = [
        {
            keys: ['shell','eco','marathon','brazil','brasil','americas','result','win','won','place','efficiency','km/kwh','mi/kwh','373','196','racing','borregos'],
            answer: "\uD83C\uDFC6 Competed with <strong>Borregos Racing</strong> at two Shell Eco-marathon editions in 2025:<br>\u2022 <strong>Americas</strong> \u2014 2nd place \u00B7 196.8 mi/kWh<br>\u2022 <strong>Brazil</strong> \u2014 2nd place \u00B7 373.2 km/kWh<br>Both in the Prototype Battery-Electric category. Focused on energy systems optimization and vehicle subsystem integration."
        },
        {
            keys: ['exoskeleton','chairless','chair','passive','lower','limb','leg','biomech','knee','linkage','wearable'],
            answer: "The <strong>Chairless Chair</strong> is a passive lower-limb exoskeleton I'm currently building. A locking knee linkage transfers body weight through an aluminum frame directly to the ground, cutting static muscle fatigue. Target: industrial assembly lines and rehab. Currently at ~40% build progress."
        },
        {
            keys: ['skill','know','language','python','c++','matlab','javascript','pytorch','tensorflow','opencv','arduino','solidworks','git','linux'],
            answer: "My main skills:<br><strong>Programming:</strong> Python, C++, JavaScript, MATLAB<br><strong>AI/ML:</strong> PyTorch, TensorFlow, OpenCV, scikit-learn<br><strong>Robotics/HW:</strong> Arduino, SolidWorks, 3D Printing<br><strong>Tools:</strong> Git, Linux, VS Code, Flask"
        },
        {
            keys: ['ai','machine learning','deep learning','neural','ml','intelligence','nvidia','certificate','cert','santander','course'],
            answer: "I hold two AI certifications:<br>\u2022 <strong>NVIDIA DLI</strong> \u2014 Fundamentals of Deep Learning<br>\u2022 <strong>Santander Open Academy</strong> \u2014 Introduction to AI Engineering<br>Also learning AI through real projects (PyTorch, TensorFlow, OpenCV) and research at SHIELD."
        },
        {
            keys: ['experience','work','shield','research','becario','scholar'],
            answer: "Current experience:<br>\u2022 <strong>Borregos Racing</strong> (2024\u2013present) \u2014 energy systems & vehicle integration, two 2nd-place finishes at Shell Eco-marathon<br>\u2022 <strong>SHIELD Research Scholar</strong> (2025\u2013present) \u2014 robotics, automation, and AI at ITESM"
        },
        {
            keys: ['education','study','school','itesm','tec','monterrey','semester','degree','mechatronics','university'],
            answer: "Studying <strong>Mechatronics Engineering</strong> at <strong>Tecnológico de Monterrey (ITESM)</strong>, currently in my 4th semester. Focus: AI, robotics, and automation."
        },
        {
            keys: ['internship','hire','job','part-time','part time','opportunity','open','available','recruit','looking'],
            answer: "Yes! Actively looking for <strong>part-time roles or internships</strong> in AI, robotics, or automation \u2014 something that can run alongside my classes. Reach me at <a href='mailto:vmcarlos024@gmail.com' style='color:#c4b5fd'>vmcarlos024@gmail.com</a>"
        },
        {
            keys: ['contact','email','linkedin','github','reach','find','social','connect'],
            answer: "Best ways to reach me:<br>\u2022 Email: <a href='mailto:vmcarlos024@gmail.com' style='color:#c4b5fd'>vmcarlos024@gmail.com</a><br>\u2022 LinkedIn: <a href='https://www.linkedin.com/in/carlos-velasco-moreno' target='_blank' style='color:#c4b5fd'>carlos-velasco-moreno</a><br>\u2022 GitHub: <a href='https://github.com/CharlsMex24' target='_blank' style='color:#c4b5fd'>CharlsMex24</a>"
        },
        {
            keys: ['project','portfolio','build','built','current','doing'],
            answer: "Current / recent projects:<br>\u2022 <strong>Chairless Chair</strong> \u2014 passive lower-limb exoskeleton (in progress)<br>\u2022 <strong>Borregos Racing EV</strong> \u2014 energy-efficient prototype vehicle<br>\u2022 <strong>SHIELD Research</strong> \u2014 robotics & AI at ITESM<br>Check the Portfolio section above for full details!"
        },
        {
            keys: ['who','about','yourself','you','carlos','name','intro','tell me','hello','hi','hey'],
            answer: "Hey! I'm <strong>Carlos Velasco</strong>, a Mechatronics Engineering student at ITESM Monterrey (4th semester). Focused on AI, robotics, and automation. I've competed at Shell Eco-marathon (2nd place twice), building a passive exoskeleton, and doing research at SHIELD. Ask me anything!"
        },
        {
            keys: ['cv','resume','pdf','download'],
            answer: "You can view and download my CV here: <a href='assets/documents/cv.pdf' target='_blank' style='color:#c4b5fd'>Open CV PDF \u2192</a>"
        },
        {
            keys: ['goal','plan','future','aspire','dream','company','startup','create'],
            answer: "Short-term: land a part-time job or internship in AI/robotics while finishing my degree. Long-term: build a company at the intersection of AI and industrial automation \u2014 intelligent systems that work in physical environments."
        }
    ];

    var FALLBACKS = [
        "Not sure about that \u2014 try asking about my <strong>projects</strong>, <strong>skills</strong>, <strong>Shell Eco-marathon</strong> results, or if I'm open to <strong>internships</strong>!",
        "Outside my knowledge base. Try: 'What are your skills?' or 'Tell me about the Chairless Chair'.",
        "No answer for that one. Reach me at <a href='mailto:vmcarlos024@gmail.com' style='color:#c4b5fd'>vmcarlos024@gmail.com</a>!"
    ];

    var fallbackIdx = 0;
    var chatOpen = false;
    var greeted = false;

    var win   = document.getElementById('chatWindow');
    var msgs  = document.getElementById('chatMessages');
    var inputEl = document.getElementById('chatInput');
    var tip   = document.getElementById('chatTip');
    var btnEl = document.getElementById('chatbotBtn');
    var chips = document.getElementById('chatChips');

    if(tip) setTimeout(function(){ tip.style.opacity='0'; setTimeout(function(){ tip.style.display='none'; },400); }, 5000);

    function toggleChat(){
        chatOpen = !chatOpen;
        if(win) win.classList.toggle('open', chatOpen);
        if(btnEl){
            btnEl.querySelector('.chat-icon-open').style.display  = chatOpen ? 'none' : '';
            btnEl.querySelector('.chat-icon-close').style.display = chatOpen ? ''     : 'none';
        }
        if(tip) tip.style.display='none';
        if(chatOpen && !greeted){
            greeted = true;
            setTimeout(function(){ addBot("Hey! I'm a quick chatbot version of Carlos. Ask me about my projects, skills, competitions, or whether I'm open to work \u2014 I'll do my best to answer!"); }, 350);
        }
        if(chatOpen) setTimeout(function(){ if(inputEl) inputEl.focus(); }, 400);
    }

    function addMsg(html, role){
        var wrap = document.createElement('div');
        wrap.className = 'chat-msg ' + role;
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.innerHTML = html;
        wrap.appendChild(bubble);
        msgs.appendChild(wrap);
        msgs.scrollTop = msgs.scrollHeight;
        return wrap;
    }

    function addBot(html){
        var typing = document.createElement('div');
        typing.className = 'chat-msg bot';
        typing.innerHTML = '<div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
        msgs.appendChild(typing);
        msgs.scrollTop = msgs.scrollHeight;
        var delay = 600 + Math.min(html.length * 1.5, 800);
        setTimeout(function(){
            if(msgs.contains(typing)) msgs.removeChild(typing);
            addMsg(html, 'bot');
        }, delay);
    }

    function respond(text){
        var lower = text.toLowerCase();
        for(var i=0; i<KB.length; i++){
            var entry = KB[i];
            for(var j=0; j<entry.keys.length; j++){
                if(lower.indexOf(entry.keys[j]) !== -1){
                    return entry.answer;
                }
            }
        }
        var fb = FALLBACKS[fallbackIdx % FALLBACKS.length];
        fallbackIdx++;
        return fb;
    }

    function send(text){
        var trimmed = text.trim();
        if(!trimmed) return;
        addMsg(trimmed, 'user');
        if(chips) chips.style.display = 'none';
        addBot(respond(trimmed));
    }

    function handleChatSubmit(e){
        e.preventDefault();
        if(!inputEl) return;
        var val = inputEl.value;
        inputEl.value = '';
        send(val);
    }

    function sendChip(el){
        send(el.textContent.trim());
    }

    window.toggleChat       = toggleChat;
    window.handleChatSubmit = handleChatSubmit;
    window.sendChip         = sendChip;
})();

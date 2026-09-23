import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { APP_CONFIG, MODEL_CATALOG } from "./config.js?v=20260923-pro1";

const supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { mode: "basic", user: null, usage: { basic: 0, advanced: 0 }, answer: "" };
const els = { prompt: $("#prompt"), result: $("#result"), resultContent: $("#resultContent"), provider: $("#provider"), model: $("#model") };

function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600); }
function renderAnswer(text){
  const html=window.marked?window.marked.parse(text,{gfm:true,breaks:true}):text.replace(/\n/g,"<br>");
  els.resultContent.innerHTML=window.DOMPurify?window.DOMPurify.sanitize(html,{ADD_TAGS:["annotation","math","mrow","mi","mo","mn","msup","msub","mfrac","semantics"]}):html;
  if(window.renderMathInElement)window.renderMathInElement(els.resultContent,{delimiters:[{left:"$$",right:"$$",display:true},{left:"\\[",right:"\\]",display:true},{left:"\\(",right:"\\)",display:false},{left:"$",right:"$",display:false}],throwOnError:false});
}
function studioMeta(){return {subject:$("#subject").value,grade:$("#grade").value,materialType:$("#materialType").value,difficulty:$("#difficulty").value,includeAnswers:$("#includeAnswers").checked,teacherVersion:$("#teacherVersion").checked,scienceFormat:$("#scienceFormat").checked};}
function safeName(){return `${$("#materialType").value}-${$("#subject").value}-lop-${$("#grade").value}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^a-zA-Z0-9-]+/g,"-").replace(/-+/g,"-").toLowerCase();}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function renderModels() { els.model.innerHTML=MODEL_CATALOG[els.provider.value].map(m=>`<option value="${m.id}">${m.label}</option>`).join(""); }
function setMode(mode) {
  state.mode=mode; $$(".mode-card").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  const advanced=mode==="advanced"; $("#advancedOptions").hidden=!advanced;
  $("#modeTitle").textContent=advanced?"Xây dựng học liệu chuyên sâu":"Hỏi nhanh — làm ngay";
  $("#modeDescription").textContent=advanced?"Dùng tài liệu nền, chọn model và kiểm soát độ dài đầu ra.":"Phù hợp với câu lệnh ngắn và nội dung vừa phải.";
  els.prompt.maxLength=advanced?8000:APP_CONFIG.basicPromptLimit; updateCount(); updateUsage();
}
function updateCount(){ const max=state.mode==="basic"?APP_CONFIG.basicPromptLimit:8000; $("#charCount").textContent=`${els.prompt.value.length.toLocaleString("vi-VN")} / ${max.toLocaleString("vi-VN")} ký tự`; }
function updateUsage(){ const limit=state.mode==="basic"?APP_CONFIG.basicDailyLimit:APP_CONFIG.advancedDailyLimit; const used=state.usage[state.mode]||0; $("#usageText").textContent=`${used} / ${limit}`; $("#usageBar").style.width=`${Math.min(100,used/limit*100)}%`; }
function reset(){ els.prompt.value=""; $("#context").value=""; state.answer=""; els.result.hidden=true; updateCount(); }
async function loadUsage(){ if(!state.user)return; const {data}=await supabase.from("usage_events").select("mode").gte("created_at",new Date(Date.now()-86400000).toISOString()); state.usage={basic:0,advanced:0}; (data||[]).forEach(x=>state.usage[x.mode]++); updateUsage(); }
function applySession(session){ state.user=session?.user||null; $("#authButton").textContent=state.user?"Đăng xuất":"Đăng nhập"; }
async function syncAuth(){ const {data:{session}}=await supabase.auth.getSession(); applySession(session); if(state.user)await loadUsage(); }
async function submit(){
  const prompt=els.prompt.value.trim(); if(!prompt)return toast("Thầy/cô vui lòng nhập yêu cầu.");
  if(state.mode==="basic" && prompt.length>APP_CONFIG.basicPromptLimit){ $("#upgradeDialog").showModal(); return; }
  if(!state.user){ $("#authDialog").showModal(); return; }
  const limit=state.mode==="basic"?APP_CONFIG.basicDailyLimit:APP_CONFIG.advancedDailyLimit;
  if((state.usage[state.mode]||0)>=limit)return toast("Đã đạt hạn mức hôm nay.");
  const button=$("#sendButton"); button.disabled=true; button.querySelector("span").textContent="Đang tạo..."; els.result.hidden=false; els.result.classList.add("loading"); els.resultContent.textContent="Trợ lý đang tổng hợp nội dung phù hợp...";
  try{
    const body={mode:state.mode,prompt,...studioMeta(),provider:state.mode==="basic"?"openai":els.provider.value,model:state.mode==="basic"?"gpt-6-luna":els.model.value,maxOutputTokens:state.mode==="basic"?700:Number($("#outputLimit").value),context:state.mode==="advanced"?$("#context").value.trim():""};
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Quá thời gian chờ 60 giây. Hãy kiểm tra Logs của Edge Function.")),60000));
    const {data,error}=await Promise.race([supabase.functions.invoke(APP_CONFIG.functionName,{body}),timeout]);
    if(error){
      let detail=error.message;
      try{const payload=await error.context.clone().json();detail=payload.error||detail}catch{}
      throw new Error(detail);
    }
    if(data?.upgradeRequired){ $("#upgradeDialog").showModal(); els.result.hidden=true; return; }
    if(!data?.text)throw new Error(data?.error||"Không nhận được nội dung.");
    state.answer=data.text; renderAnswer(state.answer); state.usage[state.mode]=(state.usage[state.mode]||0)+1; updateUsage();
  }catch(e){ els.resultContent.textContent=`Chưa thể kết nối trợ lý: ${e.message}. Vui lòng kiểm tra Edge Function và khóa API.`; }
  finally{ els.result.classList.remove("loading"); button.disabled=false; button.querySelector("span").textContent="Tạo nội dung"; }
}

$$('.mode-card').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode))); els.prompt.addEventListener("input",updateCount); els.provider.addEventListener("change",renderModels); $("#sendButton").addEventListener("click",submit); $("#clearButton").addEventListener("click",reset);
$$('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{els.prompt.value=b.dataset.prompt;updateCount();els.prompt.focus()}));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close())); $("#switchAdvanced").addEventListener("click",()=>{$("#upgradeDialog").close();setMode("advanced")});
$("#authButton").addEventListener("click",async()=>{if(state.user){const {error}=await supabase.auth.signOut(); if(error)return toast(`Chưa thể đăng xuất: ${error.message}`); applySession(null); state.usage={basic:0,advanced:0}; updateUsage(); toast("Đã đăng xuất.")}else $("#authDialog").showModal()});
$("#authForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const button=e.submitter||$("#authForm button[type='submit']");
  $("#authError").textContent=""; button.disabled=true;
  try{
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Máy chủ đăng nhập không phản hồi sau 15 giây.")),15000));
    const {data,error}=await Promise.race([supabase.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value}),timeout]);
    if(error)throw error;
    applySession(data.session); $("#authDialog").close(); toast("Đăng nhập thành công.");
    setTimeout(()=>loadUsage(),0);
  }catch(error){ $("#authError").textContent=error.message||"Không thể đăng nhập."; }
  finally{ button.disabled=false; }
});
$("#signUpButton").addEventListener("click",async()=>{
  const emailRedirectTo=new URL("./",window.location.href).href;
  const {error}=await supabase.auth.signUp({
    email:$("#email").value,
    password:$("#password").value,
    options:{emailRedirectTo}
  });
  $("#authError").textContent=error?error.message:"Đã gửi xác nhận. Vui lòng kiểm tra email.";
});
$("#contextFile").addEventListener("change",async(e)=>{const f=e.target.files[0]; if(!f)return; if(f.size>1024*1024)return toast("Tệp tối đa 1 MB."); $("#context").value=(await f.text()).slice(0,20000); toast("Đã nạp tệp văn bản.")});
$("#copyButton").addEventListener("click",async()=>{await navigator.clipboard.writeText(state.answer);toast("Đã sao chép.")});
$("#downloadButton").addEventListener("click",()=>downloadBlob(new Blob([state.answer],{type:"text/plain;charset=utf-8"}),safeName()+".txt"));
$("#docxButton").addEventListener("click",()=>{
  if(!state.answer)return toast("Chưa có học liệu để xuất.");
  if(!window.htmlDocx)return toast("Thư viện Word chưa tải xong, vui lòng tải lại trang.");
  const meta=studioMeta();
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:2cm}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.5;color:#000}h1,h2,h3{font-size:14pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:6px}th{background:#e8eeee}.doc-meta{font-size:10pt;color:#555;border-bottom:1px solid #777;padding-bottom:8px;margin-bottom:14px}</style></head><body><div class="doc-meta">TRƯỜNG THCS LỘC NINH · ${meta.subject} · Lớp ${meta.grade} · ${meta.materialType}</div>${els.resultContent.innerHTML}</body></html>`;
  const blob=window.htmlDocx.asBlob(html,{orientation:"portrait",margins:{top:1134,right:1134,bottom:1134,left:1134}});
  downloadBlob(blob,safeName()+".docx"); toast("Đã tạo file Word.");
});
$("#pdfButton").addEventListener("click",async()=>{
  if(!state.answer)return toast("Chưa có học liệu để xuất.");
  if(!window.html2pdf)return window.print();
  const clone=els.resultContent.cloneNode(true); const wrapper=document.createElement("div");
  wrapper.style.cssText='font-family:"Times New Roman",serif;font-size:12pt;line-height:1.5;color:#000;padding:10px'; wrapper.appendChild(clone);
  await window.html2pdf().set({margin:12,filename:safeName()+".pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(wrapper).save();
});
renderModels(); setMode("basic"); syncAuth();
supabase.auth.onAuthStateChange((_event,session)=>{
  applySession(session);
  if(session)setTimeout(()=>loadUsage(),0);
  else{state.usage={basic:0,advanced:0};updateUsage();}
});

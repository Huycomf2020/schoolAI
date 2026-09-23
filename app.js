import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { APP_CONFIG, MODEL_CATALOG } from "./config.js";

const supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { mode: "basic", user: null, usage: { basic: 0, advanced: 0 }, answer: "" };
const els = { prompt: $("#prompt"), result: $("#result"), resultContent: $("#resultContent"), provider: $("#provider"), model: $("#model") };

function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600); }
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
async function syncAuth(){ const {data:{session}}=await supabase.auth.getSession(); state.user=session?.user||null; $("#authButton").textContent=state.user?"Đăng xuất":"Đăng nhập"; await loadUsage(); }
async function submit(){
  const prompt=els.prompt.value.trim(); if(!prompt)return toast("Thầy/cô vui lòng nhập yêu cầu.");
  if(state.mode==="basic" && prompt.length>APP_CONFIG.basicPromptLimit){ $("#upgradeDialog").showModal(); return; }
  if(!state.user){ $("#authDialog").showModal(); return; }
  const limit=state.mode==="basic"?APP_CONFIG.basicDailyLimit:APP_CONFIG.advancedDailyLimit;
  if((state.usage[state.mode]||0)>=limit)return toast("Đã đạt hạn mức hôm nay.");
  const button=$("#sendButton"); button.disabled=true; button.querySelector("span").textContent="Đang tạo..."; els.result.hidden=false; els.result.classList.add("loading"); els.resultContent.textContent="Trợ lý đang tổng hợp nội dung phù hợp...";
  try{
    const body={mode:state.mode,prompt,provider:state.mode==="basic"?"openai":els.provider.value,model:state.mode==="basic"?"gpt-6-luna":els.model.value,maxOutputTokens:state.mode==="basic"?700:Number($("#outputLimit").value),context:state.mode==="advanced"?$("#context").value.trim():""};
    const {data,error}=await supabase.functions.invoke(APP_CONFIG.functionName,{body}); if(error)throw error;
    if(data?.upgradeRequired){ $("#upgradeDialog").showModal(); els.result.hidden=true; return; }
    if(!data?.text)throw new Error(data?.error||"Không nhận được nội dung.");
    state.answer=data.text; els.resultContent.textContent=state.answer; state.usage[state.mode]=(state.usage[state.mode]||0)+1; updateUsage();
  }catch(e){ els.resultContent.textContent=`Chưa thể kết nối trợ lý: ${e.message}. Vui lòng kiểm tra Edge Function và khóa API.`; }
  finally{ els.result.classList.remove("loading"); button.disabled=false; button.querySelector("span").textContent="Tạo nội dung"; }
}

$$('.mode-card').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode))); els.prompt.addEventListener("input",updateCount); els.provider.addEventListener("change",renderModels); $("#sendButton").addEventListener("click",submit); $("#clearButton").addEventListener("click",reset);
$$('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{els.prompt.value=b.dataset.prompt;updateCount();els.prompt.focus()}));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close())); $("#switchAdvanced").addEventListener("click",()=>{$("#upgradeDialog").close();setMode("advanced")});
$("#authButton").addEventListener("click",async()=>{if(state.user){await supabase.auth.signOut(); await syncAuth(); toast("Đã đăng xuất.")}else $("#authDialog").showModal()});
$("#authForm").addEventListener("submit",async(e)=>{e.preventDefault(); $("#authError").textContent=""; const {error}=await supabase.auth.signInWithPassword({email:$("#email").value,password:$("#password").value}); if(error)return $("#authError").textContent=error.message; $("#authDialog").close(); await syncAuth(); toast("Đăng nhập thành công.")});
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
$("#downloadButton").addEventListener("click",()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([state.answer],{type:"text/plain;charset=utf-8"}));a.download="hoc-lieu-thcs-loc-ninh.txt";a.click();URL.revokeObjectURL(a.href)});
renderModels(); setMode("basic"); syncAuth(); supabase.auth.onAuthStateChange(()=>syncAuth());

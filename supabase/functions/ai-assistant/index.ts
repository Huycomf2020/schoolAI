import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const models={openai:new Set(["gpt-6-luna","gpt-6-sol"]),gemini:new Set(["gemini-2.5-flash-lite","gemini-2.5-flash"])};
const SYSTEM=`Bạn là trợ lý học liệu nội bộ của Trường THCS Lộc Ninh. Viết tiếng Việt chuẩn, rõ ràng, phù hợp môi trường THCS. Ưu tiên tính chính xác, khả thi, cấu trúc khoa học. Không bịa văn bản pháp lý; khi chưa chắc phải nói rõ cần kiểm tra. Không tiết lộ dữ liệu cá nhân hoặc hướng dẫn gây hại.`;
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const auth=req.headers.get("Authorization"); if(!auth)return json({error:"Vui lòng đăng nhập."},401);
    const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError}=await sb.auth.getUser(); if(userError||!user)return json({error:"Phiên đăng nhập không hợp lệ."},401);
    const body=await req.json(); const mode=body.mode==="advanced"?"advanced":"basic"; const prompt=String(body.prompt||"").trim();
    if(!prompt)return json({error:"Yêu cầu trống."},400); if(mode==="basic"&&prompt.length>600)return json({upgradeRequired:true},200); if(prompt.length>8000)return json({error:"Yêu cầu quá dài."},400);
    const limit=mode==="basic"?30:15; const since=new Date(Date.now()-86400000).toISOString();
    const {count}=await sb.from("usage_events").select("id",{count:"exact",head:true}).eq("mode",mode).gte("created_at",since); if((count||0)>=limit)return json({error:"Đã đạt hạn mức 24 giờ."},429);
    const provider=mode==="basic"?"openai":body.provider==="gemini"?"gemini":"openai"; const fallback=provider==="openai"?"gpt-6-luna":"gemini-2.5-flash-lite"; const model=models[provider].has(body.model)?body.model:fallback;
    const max=Math.min(mode==="basic"?700:4000,Math.max(200,Number(body.maxOutputTokens)||700)); const context=mode==="advanced"?String(body.context||"").slice(0,20000):"";
    const input=context?`NGỮ CẢNH THAM KHẢO:\n${context}\n\nYÊU CẦU:\n${prompt}`:prompt; let text=""; let inputTokens=0,outputTokens=0;
    if(provider==="openai"){
      const key=Deno.env.get("OPENAI_API_KEY"); if(!key)return json({error:"Quản trị viên chưa cấu hình OPENAI_API_KEY."},503);
      const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:SYSTEM,input,max_output_tokens:max})}); const d=await r.json(); if(!r.ok)throw new Error(d.error?.message||"OpenAI request failed");
      text=d.output_text||d.output?.flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==="output_text").map((x:any)=>x.text).join("\n")||""; inputTokens=d.usage?.input_tokens||0; outputTokens=d.usage?.output_tokens||0;
    }else{
      const key=Deno.env.get("GEMINI_API_KEY"); if(!key)return json({error:"Quản trị viên chưa cấu hình GEMINI_API_KEY."},503);
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:input}]}],generationConfig:{maxOutputTokens:max}})}); const d=await r.json(); if(!r.ok)throw new Error(d.error?.message||"Gemini request failed");
      text=d.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("\n")||""; inputTokens=d.usageMetadata?.promptTokenCount||0; outputTokens=d.usageMetadata?.candidatesTokenCount||0;
    }
    await sb.from("usage_events").insert({user_id:user.id,mode,provider,model,input_tokens:inputTokens,output_tokens:outputTokens}); return json({text,provider,model,usage:{inputTokens,outputTokens}});
  }catch(e){console.error(e);return json({error:e instanceof Error?e.message:"Lỗi không xác định."},500)}
});

window.MozakraAPI = (()=>{
  async function request(action, body){
    let response;
    try{
      response = await fetch('/api/backend?action='+encodeURIComponent(action),{
        method: body===undefined ? 'GET':'POST',
        headers: body===undefined ? {} : {'Content-Type':'application/json'},
        credentials:'same-origin',
        body: body===undefined ? undefined : JSON.stringify(body)
      });
    }catch(e){
      const err=new Error('تعذر الاتصال بالسيرفر. تأكد من نشر مجلد api على Vercel.'); err.code='NETWORK_ERROR'; throw err;
    }
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data.ok===false){const err=new Error(data.message||'تعذر تنفيذ الطلب.');err.code=data.error||'REQUEST_FAILED';err.status=response.status;throw err;}
    return data;
  }
  return {request};
})();

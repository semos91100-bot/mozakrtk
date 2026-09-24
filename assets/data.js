// ============ بيانات أساسية ============
const SUBJECTS = [
  { id:"physics", name:"الفيزياء", icon:"⚛️", color:"#1d4ed8" },
  { id:"chemistry", name:"الكيمياء", icon:"🧪", color:"#0f766e" },
  { id:"biology", name:"الأحياء", icon:"🧬", color:"#15803d" },
  { id:"arabic", name:"اللغة العربية", icon:"📖", color:"#b45309" },
  { id:"english", name:"English", icon:"🔤", color:"#7c3aed" },
];

const TEACHERS = [
  { id:1, name:"أ. محمد سامي", subject:"physics", bio:"مدرّس فيزياء لثالثة ثانوي، متخصص في الميكانيكا والكهرومغناطيسية." },
  { id:2, name:"أ. سارة عادل", subject:"chemistry", bio:"مدرّسة كيمياء، تركّز على الكيمياء العضوية والاتزان الكيميائي." },
  { id:3, name:"أ. أحمد خالد", subject:"biology", bio:"مدرّس أحياء، خبرة في تبسيط الوراثة والفسيولوجي." },
  { id:4, name:"أ. منى فتحي", subject:"arabic", bio:"مدرّسة لغة عربية، نحو وأدب وبلاغة." },
  { id:5, name:"أ. يوسف عمر", subject:"english", bio:"English teacher — grammar, reading & writing focus." },
];

// تصنيفات وأولويات نظام تذاكر الدعم الفني
const TICKET_CATEGORIES = [
  { id:"technical", name:"مشكلة تقنية" },
  { id:"academic", name:"استفسار تعليمي" },
  { id:"billing", name:"الاشتراك والدفع" },
  { id:"account", name:"الحساب وتسجيل الدخول" },
  { id:"suggestion", name:"اقتراح" },
  { id:"other", name:"أخرى" },
];

const TICKET_PRIORITIES = [
  { id:"low", name:"منخفضة" },
  { id:"medium", name:"متوسطة" },
  { id:"high", name:"عالية" },
  { id:"urgent", name:"عاجلة" },
];

const TICKET_STATUSES = [
  { id:"open", name:"مفتوحة", cls:"open" },
  { id:"progress", name:"قيد المعالجة", cls:"progress" },
  { id:"resolved", name:"تم الحل", cls:"resolved" },
  { id:"closed", name:"مغلقة", cls:"closed" },
];

const ADMIN_ACCOUNT = { email:"semos91100@gmail.com", password:"alton112233", name:"إدارة مُذاكرة" };

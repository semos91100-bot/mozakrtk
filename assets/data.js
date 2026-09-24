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

// ============ اختبارات تجريبية (نموذج — تقدر تستبدلها بأسئلة منهجك) ============
const EXAMS = {
  physics: { title:"اختبار تجريبي — الفيزياء", questions:[
    { q:"وحدة قياس الشغل في النظام الدولي هي:", options:["نيوتن","جول","واط","باسكال"], correct:1 },
    { q:"العلاقة بين القوة والتسارع (F=ma) هي:", options:["قانون نيوتن الأول","قانون نيوتن الثاني","قانون نيوتن الثالث","قانون الجذب العام"], correct:1 },
    { q:"وحدة قياس شدة التيار الكهربي هي:", options:["فولت","أوم","أمبير","واط"], correct:2 },
    { q:"سرعة الضوء في الفراغ تساوي تقريبًا:", options:["3×10^5 م/ث","3×10^8 م/ث","3×10^6 م/ث","3×10^3 م/ث"], correct:1 },
    { q:"الطاقة الحركية لجسم تعتمد على:", options:["الكتلة فقط","السرعة فقط","الكتلة والسرعة معًا","الوزن فقط"], correct:2 },
  ]},
  chemistry: { title:"اختبار تجريبي — الكيمياء", questions:[
    { q:"الرقم الهيدروجيني (pH) للمحلول المتعادل يساوي:", options:["0","7","14","1"], correct:1 },
    { q:"العنصر الذي رمزه Na هو:", options:["نيتروجين","نيكل","صوديوم","نحاس"], correct:2 },
    { q:"الرابطة التي تنشأ من مشاركة إلكترونات تسمى:", options:["أيونية","تساهمية","فلزية","هيدروجينية"], correct:1 },
    { q:"عدد أفوجادرو يستخدم لحساب:", options:["الكتلة الذرية","عدد الجسيمات في المول","الحجم المولي فقط","درجة الحرارة"], correct:1 },
    { q:"غاز ثاني أكسيد الكربون CO2 يُصنَّف كـ:", options:["عنصر","مركب","خليط متجانس فلزي","أيون"], correct:1 },
  ]},
  biology: { title:"اختبار تجريبي — الأحياء", questions:[
    { q:"الوحدة البنائية والوظيفية للكائن الحي هي:", options:["النسيج","الخلية","العضو","الجهاز"], correct:1 },
    { q:"عملية البناء الضوئي تحدث في:", options:["الميتوكوندريا","البلاستيدات الخضراء","النواة","الريبوسومات"], correct:1 },
    { q:"الـ DNA يوجد بشكل أساسي في:", options:["السيتوبلازم","النواة","الغشاء الخلوي","الفجوة العصارية"], correct:1 },
    { q:"عدد الكروموسومات في الخلية الجسدية للإنسان:", options:["23","46","44","48"], correct:1 },
    { q:"الهرمون المسؤول عن تنظيم سكر الدم بالأساس هو:", options:["الأنسولين","الأدرينالين","الثيروكسين","الاستروجين"], correct:0 },
  ]},
  arabic: { title:"اختبار تجريبي — اللغة العربية", questions:[
    { q:"الفعل \"كَتَبَ\" مبني على:", options:["الفتح","الضم","الكسر","السكون"], correct:0 },
    { q:"جمع كلمة \"كتاب\" هو:", options:["كتب","كتابون","كتّاب","كتابات"], correct:0 },
    { q:"\"إنَّ\" وأخواتها تدخل على الجملة الاسمية وتفيد:", options:["النفي","التوكيد وغيره","الاستفهام","الشرط"], correct:1 },
    { q:"الاسم الموصول للمفرد المذكر هو:", options:["اللتان","الذي","اللواتي","اللذان"], correct:1 },
    { q:"نوع الأسلوب في جملة \"ما أجمل السماء!\" هو:", options:["أسلوب نداء","أسلوب تعجب","أسلوب استفهام","أسلوب شرط"], correct:1 },
  ]},
  english: { title:"Practice Test — English", questions:[
    { q:"Choose the correct form: She ___ to school every day.", options:["go","goes","going","gone"], correct:1 },
    { q:"The opposite of \"increase\" is:", options:["raise","decrease","grow","expand"], correct:1 },
    { q:"\"Although it was raining, we went out.\" This sentence shows:", options:["Cause","Contrast","Result","Condition"], correct:1 },
    { q:"Choose the correct passive form: The book ___ by the teacher.", options:["read","was read","is reading","reads"], correct:1 },
    { q:"Synonym of \"important\":", options:["trivial","significant","boring","random"], correct:1 },
  ]},
};

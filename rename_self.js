/**
 * Sub-Store rename script (Stable HK hard-lock + EN boundary + no-FG, clear=ON by default)
 * 修复/特性：
 * 1) 默认识别不使用国旗表 FG（除非 in=flag）
 * 2) EN 两字母国家码词边界匹配（abs=en|all|off；默认 en）
 * 3) 归一化后对“(深|沪|呼|京|广|杭)港”硬锁为『香港』
 * 4) IEPL/IPLC/BGP 断词兜底（I-E-P-L / I-P-L-C / B-G-P）
 * 5) 过滤空键，避免 "" 命中一切
 * 6) ✅ 清理信息节点 clear 默认开启（可通过 clear=false 关闭）
 * 7) ✅ boolArg 修复：把空字符串/空白当作“未传入”，默认值不被错误覆盖
 */

const inArg = $arguments;

// —— 布尔参数解析辅助（修复：把空字符串当作“未传入”） —— //
function boolArg(v, d = false) {
  if (v === undefined || v === null) return d;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return d; // 关键：空字符串走默认
    if (/^(true|1|on|yes)$/i.test(s)) return true;
    if (/^(false|0|off|no)$/i.test(s)) return false;
    return d; // 未知值走默认
  }
  return !!v;
}

const nx     = boolArg(inArg.nx, false),
      bl     = boolArg(inArg.bl, false),
      nf     = boolArg(inArg.nf, false),
      key    = boolArg(inArg.key, false),
      blgd   = boolArg(inArg.blgd, false),
      blpx   = boolArg(inArg.blpx, false),
      blnx   = boolArg(inArg.blnx, false),
      numone = boolArg(inArg.one, false),
      debug  = boolArg(inArg.debug, false),

      // ✅ 默认开启清理信息节点
      clear  = boolArg(inArg.clear, true),

      addflag= boolArg(inArg.flag, false),
      nm     = boolArg(inArg.nm, false);

// 严格边界匹配模式：en(默认，仅 EN 两字母) | all(全部识别词) | off(关闭)
const ABSMODE = (inArg.abs || "en").toLowerCase();

const FGF = inArg.fgf == undefined ? " " : decodeURI(inArg.fgf),
      XHFGF = inArg.sn == undefined ? " " : decodeURI(inArg.sn),
      FNAME = inArg.name == undefined ? "" : decodeURI(inArg.name),
      BLKEY = inArg.blkey == undefined ? "" : decodeURI(inArg.blkey),
      blockquic = inArg.blockquic == undefined ? "" : decodeURI(inArg.blockquic),
      nameMap = { cn: "cn", zh: "cn", us: "us", en: "us", quan: "quan", gq: "gq", flag: "gq" },
      inname = nameMap[inArg.in] || "",
      outputName = nameMap[inArg.out] || "";

// ==================== 数据表 ====================
// prettier-ignore
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱']
// prettier-ignore
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];
// prettier-ignore
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];
// prettier-ignore
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];

// ==================== 识别/清理配置 ====================
const specialRegex = [
  /(\d\.)?\d+×/,
  /IPLC|IEPL|Kern|Edge|Pro|Std|Exp|Biz|Fam|Game|Buy|Zx|LB|Game/,
];

// 内置信息节点清理正则（clear=true 时生效）
const nameclear =
  /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL)/i;

// IEPL/IPLC 同时识别分隔写法
// prettier-ignore
const regexArray=[/ˣ²/, /ˣ³/, /ˣ⁴/, /ˣ⁵/, /ˣ⁶/, /ˣ⁷/, /ˣ⁸/, /ˣ⁹/, /ˣ¹⁰/, /ˣ²⁰/, /ˣ³⁰/, /ˣ⁴⁰/, /ˣ⁵⁰/, /专线/, /(IPLC|I-P-L-C)/i, /(IEPL|I-E-P-L)/i, /核心/, /边缘/, /高级/, /标准/, /特殊/, /实验/, /商宽/, /家宽/, /家庭宽带/,/游戏|game/i, /购物/, /LB/, /cloudflare/i, /\budp\b/i, /\bgpt\b/i, /udpn\b/, ];
// prettier-ignore
const valueArray= [ "2×","3×","4×","5×","6×","7×","8×","9×","10×","20×","30×","40×","50×","DL","IPLC","IEPL","Kern","Edge","Pro","Std","Spec","Exp","Biz","Fam","Game","Buy","LB","CF","UDP","GPT","UDPN"];

const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const namenx   = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;

const keya = /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR||||||/i;
const keyb = /(((1|2|3|4)\d)|(香港|Hong|HK) 0[5-9]|((新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR) 0[3-9]))/i;

// ==================== 归一化/预处理 ====================
const rurekey = {
  GB: /UK/g,
  "B-G-P": /BGP/g,
  "I-E-P-L": /IEPL/gi,
  "I-P-L-C": /IPLC/gi,

  // ❌ 删掉这条：会制造数组里不存在的键
  // "Dubai United Arab Emirates": /United Arab Emirates/g,

  "Russia Moscow": /Moscow/g,
  "Korea Chuncheon": /Chuncheon|Seoul/g,
  "Hong Kong": /Hongkong|HONG KONG/gi,
  "United Kingdom London": /London|Great Britain/g,

  // ✅ 归一化到 ZH 表中的规范写法


  "Taiwan TW 台湾 ": /(台|Tai\s?wan|TW).*?|.*?(台|Tai\s?wan|TW)/g,
  "United States": /USA|Los Angeles|San Jose|Silicon Valley|Michigan/g,

  澳大利亚: /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳/g,
  德国: /(深|沪|呼|京|广|杭)德|法兰克福|滬德/g,
  香港: /(深|沪|呼|京|广|杭)港/g,  // 香港硬锁
  台湾: /新台|新北|台(?!.*线)/g,
  Taiwan: /Taipei/g,
  日本: /(深|沪|呼|京|广|杭|中|辽)日|东京|大坂/g,
  新加坡: /狮城|(深|沪|呼|京|广|杭)新/g,
  美国: /(深|沪|呼|京|广|杭)美|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|芝加哥/g,
  韩国: /春川|韩|首尔/g,
  Japan: /Tokyo|Osaka/g,
  英国: /伦敦/g,
  India: /Mumbai/g,
  Germany: /Frankfurt/g,
  Switzerland: /Zurich/g,
  俄罗斯: /莫斯科/g,
  土耳其: /伊斯坦布尔/g,
  泰国: /泰國|曼谷/g,
  法国: /巴黎/g,
  波斯尼亚和黑塞哥维那: /波黑共和国/g,
  印尼: /印度尼西亚|雅加达/g,
  印度: /孟买/g,
  孟加拉国: /孟加拉/g,
  捷克: /捷克共和国/g,
  阿联酋: /(🇦🇪|阿联酋|迪拜|UAE|United\s*Arab\s*Emirates|Dubai)/gi,
  沙特阿拉伯: /(🇸🇦|沙特|沙特阿拉伯|Saudi\s*Arabia|KSA|\bSTC\b)/gi,

  家宽: /家庭宽带|家庭/g,
  G: /\d\s?GB/gi,
  Esnc: /esnc/gi,
};

// ==================== 工具函数 ====================
let GetK = false, AMK = [];
function ObjKA(i) {
  GetK = true;
  // 过滤空键，避免 "" 命中一切
  AMK = Object.entries(i).filter(([k]) => k && k.trim() !== "");
}

const EN_SET = new Set(EN);
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function isAsciiWord(s){ return /^[A-Za-z0-9]+$/.test(s); }
function matchWithBoundary(name, key){
  if (ABSMODE === "off") return name.includes(key);
  if (ABSMODE === "en") {
    if (EN_SET.has(key)) {
      const re = new RegExp(`(?:^|[^A-Za-z])${escapeReg(key)}(?:[^A-Za-z]|$)`,"i");
      return re.test(name);
    }
    return name.includes(key);
  }
  const ascii = isAsciiWord(key);
  const re = ascii
    ? new RegExp(`(?:^|[^A-Za-z0-9])${escapeReg(key)}(?:[^A-Za-z0-9]|$)`,"i")
    : new RegExp(`(?:^|[^\\u4e00-\\u9fffA-Za-z0-9])${escapeReg(key)}(?:[^\\u4e00-\\u9fffA-Za-z0-9]|$)`,"i");
  return re.test(name);
}

// ==================== 主流程 ====================
function operator(pro) {
  const Allmap = {};
  const outList = getList(outputName);
  let inputList, retainKey = "";

  // 识别优先级（默认不包含 FG；仅 in=flag 时识别国旗）
  if (inname !== "") {
    inputList = [getList(inname)];
  } else {
    inputList = [ZH, QC, EN];
  }

  // 构建映射（跳过空值）
  inputList.forEach((arr) => {
    arr.forEach((value, valueIndex) => {
      if (value && String(value).trim() !== "") {
        Allmap[value] = outList[valueIndex];
      }
    });
  });

  // —— 清理/过滤阶段 —— //
  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const keep =
        !(clear && nameclear.test(resname)) &&      // ✅ 默认清理信息节点
        !(nx && namenx.test(resname)) &&
        !(blnx && !nameblnx.test(resname)) &&
        !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname)));
      return keep;
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : "";

  pro.forEach((e) => {
    let bktf = false, ens = e.name; // ens: 原始名称（本轮处理前）

    // 预处理（归一化 + 可选 BLKEY 附加到显示）
    Object.keys(rurekey).forEach((ikey) => {
      if (rurekey[ikey].test(e.name)) {
        e.name = e.name.replace(rurekey[ikey], ikey);
        if (BLKEY) {
          bktf = true;
          let BLKEY_REPLACE = "", re = false;
          BLKEYS.forEach((i) => {
            if (i.includes(">") && ens.includes(i.split(">")[0])) {
              if (rurekey[ikey].test(i.split(">")[0])) e.name += " " + i.split(">")[0];
              if (i.split(">")[1]) { BLKEY_REPLACE = i.split(">")[1]; re = true; }
            } else {
              if (ens.includes(i)) e.name += " " + i;
            }
            retainKey = re ? BLKEY_REPLACE : BLKEYS.filter((items) => e.name.includes(items));
          });
        }
      }
    });

    // —— HOTFIX：深/沪/呼/京/广/杭 + 港 → 香港（在归一化之后、匹配之前硬锁）——
    const _hadShenGang = /(深|沪|呼|京|广|杭)港/.test(ens) || /(深|沪|呼|京|广|杭)港/.test(e.name);
    if (_hadShenGang) {
      e.name = e.name.replace(/(深|沪|呼|京|广|杭)港/gi, "香港");
    }

    // block-quic
    if (blockquic == "on") e["block-quic"]="on";
    else if (blockquic == "off") e["block-quic"]="off";
    else delete e["block-quic"];

    // 自定义保留词（未在预处理阶段命中时）
    if (!bktf && BLKEY) {
      let BLKEY_REPLACE = "", re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && e.name.includes(i.split(">")[0])) {
          if (i.split(">")[1]) { BLKEY_REPLACE = i.split(">")[1]; re = true; }
        }
      });
      retainKey = re ? BLKEY_REPLACE : BLKEYS.filter((items) => e.name.includes(items));
    }

    // 保留固定格式 倍率/标签
    let ikey = "", ikeys = "";
    if (blgd) {
      regexArray.forEach((regex, idx) => { if (regex.test(e.name)) ikeys = valueArray[idx]; });
    }

    // 正则 匹配倍率
    if (bl) {
      const match = e.name.match(/((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/);
      if (match) {
        const rev = match[0].match(/(\d[\d.]*)/)[0];
        if (rev !== "1") ikey = rev + "×";
      }
    }

    // 构建匹配键表
    if (!GetK) ObjKA(Allmap);

    // 查找首个地区键（包含 + EN 边界）
    const findKey = AMK.find(([k]) => matchWithBoundary(e.name, k));

    // 组装新名称
    let firstName = "", nNames = "";
    if (nf) firstName = FNAME; else nNames = FNAME;

    if (findKey?.[1]) {
      const findKeyValue = findKey[1];
      let keyover = [], usflag = "";
      if (addflag) {
        const idx = getList(outputName).indexOf(findKeyValue);
        if (idx !== -1) usflag = FG[idx] || "";
      }
      keyover = keyover.concat(firstName, usflag, nNames, findKeyValue, retainKey, ikey, ikeys).filter(Boolean);
      e.name = keyover.join(FGF);
    } else {
      if (nm) e.name = FNAME + FGF + e.name; else e.name = null;
    }
  });

  pro = pro.filter((e) => e.name !== null);
  jxh(pro);
  if (numone) oneP(pro);
  if (blpx) pro = fampx(pro);
  if (key) pro = pro.filter((e) => !keyb.test(e.name));
  return pro;
}

// ==================== 辅助函数 ====================
function getList(arg) {
  switch (arg) {
    case "us": return EN;
    case "gq": return FG;
    case "quan": return QC;
    default: return ZH; // 未指定 out 时默认中文
  }
}

function jxh(e){
  const n=e.reduce((e,n)=>{
    const t=e.find((e)=>e.name===n.name);
    if(t){ t.count++; t.items.push({...n,name:`${n.name}${XHFGF}${t.count.toString().padStart(2,"0")}`});}
    else { e.push({name:n.name,count:1,items:[{...n,name:`${n.name}${XHFGF}01`}],});}
    return e;
  },[]);
  const t=(typeof Array.prototype.flatMap==='function'?n.flatMap((e)=>e.items):n.reduce((a,e)=>a.concat(e.items),[]));
  e.splice(0,e.length,...t); return e;
}

function oneP(e){
  const t=e.reduce((e,t)=>{
    const n=t.name.replace(/[^A-Za-z0-9\u00C0-\u017F\u4E00-\u9FFF]+\d+$/,"");
    if(!e[n]) e[n]=[]; e[n].push(t); return e;
  },{});
  for(const e in t){
    if(t[e].length===1 && t[e][0].name.endsWith("01")){
      t[e][0].name=t[e][0].name.replace(/[^.]01/,"");
    }
  }
  return e;
}

function fampx(pro){
  const wis=[], wnout=[];
  for(const proxy of pro){
    const fan=specialRegex.some((regex)=>regex.test(proxy.name));
    if(fan) wis.push(proxy); else wnout.push(proxy);
  }
  const sps=wis.map((proxy)=>specialRegex.findIndex((regex)=>regex.test(proxy.name)));
  wis.sort((a,b)=> sps[wis.indexOf(a)]-sps[wis.indexOf(b)] || a.name.localeCompare(b.name));
  wnout.sort((a,b)=> pro.indexOf(a)-pro.indexOf(b));
  return wnout.concat(wis);
}

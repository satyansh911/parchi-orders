// Hindi UI strings (D15). Same keys as en.ts; the type makes a missing or
// extra key a compile error. Digits stay Latin (D83).

import type { MessageKey } from "./en";

export const hi: Record<MessageKey, string> = {
  "app.name": "पर्ची ऑर्डर",
  "common.loading": "लोड हो रहा है…",
  "common.retry": "फिर से कोशिश करें",
  "common.error": "कुछ गड़बड़ हो गई।",
  "common.close": "बंद करें",

  "nav.catalogue": "सामान",
  "nav.orders": "ऑर्डर",
  "nav.cart": "कार्ट",
  "nav.main": "मुख्य",

  "locale.switchTo": "English",
  "locale.switchLabel": "भाषा अंग्रेज़ी में बदलें",

  "login.title": "लॉग इन",
  "login.phoneLabel": "मोबाइल नंबर",
  "login.getCode": "कोड भेजें",
  "login.sending": "भेज रहे हैं…",
  "login.codeSentTo": "कोड {phone} पर भेजा गया",
  "login.codeLabel": "6 अंकों का कोड",
  "login.logIn": "लॉग इन करें",
  "login.checking": "जाँच रहे हैं…",
  "login.changeNumber": "नंबर बदलें",
  "login.demoBanner": "डेमो मोड: कोई SMS नहीं भेजा जाता। कोड {code} डालें।",
  "login.error.LOGIN_DISABLED": "SMS लॉग इन चालू नहीं है।",
  "login.error.INVALID_PHONE": "10 अंकों का मोबाइल नंबर डालें।",
  "login.error.INVALID_CREDENTIALS": "नंबर या कोड गलत है। फिर से कोशिश करें।",
  "login.error.INVALID_INPUT": "फ़ॉर्म में कुछ गड़बड़ है। फिर से कोशिश करें।",
  "login.error.RATE_LIMITED": "बहुत ज़्यादा कोशिशें हो गईं। 15 मिनट बाद फिर कोशिश करें।",
  "login.error.UNAUTHENTICATED": "कृपया फिर से लॉग इन करें।",
  "login.error.NOT_FOUND": "कुछ गड़बड़ हो गई। फिर से कोशिश करें।",
  "login.error.RETAILER_REQUIRED": "कुछ गड़बड़ हो गई। फिर से कोशिश करें।",

  "shell.logout": "लॉग आउट",
  "shell.loggingOut": "लॉग आउट हो रहा है…",
};

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ko";

const STORAGE_KEY = "sunny.lang";

const dict = {
  en: {
    "app.tagline": "Your friendly AI companion",
    "app.subtitle": "Sunny",
    "sidebar.newChat": "New Chat",
    "sidebar.loading": "Loading…",
    "sidebar.empty": "No chats yet. Start one ☀",
    "sidebar.signOut": "Sign out",
    "sidebar.openMenu": "Open menu",
    "sidebar.closeMenu": "Close menu",
    "sidebar.save": "Save",
    "sidebar.cancel": "Cancel",
    "sidebar.rename": "Rename",
    "sidebar.delete": "Delete",
    "sidebar.couldNotCreate": "Could not create chat",
    "sidebar.couldNotDelete": "Could not delete",
    "sidebar.couldNotRename": "Could not rename",
    "sidebar.newChatTitle": "New Chat",
    "chat.greeting": "Hi, I'm Sunny ☀",
    "chat.greetingSub": "Ask me anything, brainstorm an idea, or just say hello. I'm here to help.",
    "chat.disclaimer": "Sunny can make mistakes. Double-check important info.",
    "chat.couldNotLoad": "Could not load chat history",
    "chat.couldNotStart": "Could not start a new Chat",
    "chat.connectionError": "Connection error. Please try again.",
    "composer.placeholder": "Message Sunny…",
    "composer.send": "Send",
    "composer.stop": "Stop",
    "suggestion.1": "Give me a warm-up writing prompt",
    "suggestion.2": "Explain quantum entanglement simply",
    "suggestion.3": "Plan a cozy weekend in Lisbon",
    "suggestion.4": "Help me name my coffee shop",
    "auth.welcomeBack": "Welcome back",
    "auth.createAccount": "Create your account",
    "auth.signInSub": "Sign in to chat with Sunny ☀",
    "auth.signUpSub": "Sign up to start chatting with Sunny ☀",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.signIn": "Sign in",
    "auth.createBtn": "Create account",
    "auth.pleaseWait": "Please wait…",
    "auth.newToSunny": "New to Sunny?",
    "auth.haveAccount": "Already have an account?",
    "auth.createLink": "Create an account",
    "auth.welcomeToast": "Welcome to Sunny ☀",
    "auth.somethingWrong": "Something went wrong",
    "auth.continueWithGoogle": "Continue with Google",
    "auth.or": "or",
    "lang.label": "Language",
    "lang.en": "English",
    "lang.ko": "한국어",
  },
  ko: {
    "app.tagline": "다정한 AI 친구",
    "app.subtitle": "Sunny",
    "sidebar.newChat": "새 채팅",
    "sidebar.loading": "불러오는 중…",
    "sidebar.empty": "아직 채팅이 없어요. 시작해 보세요 ☀",
    "sidebar.signOut": "로그아웃",
    "sidebar.openMenu": "메뉴 열기",
    "sidebar.closeMenu": "메뉴 닫기",
    "sidebar.save": "저장",
    "sidebar.cancel": "취소",
    "sidebar.rename": "이름 바꾸기",
    "sidebar.delete": "삭제",
    "sidebar.couldNotCreate": "채팅을 만들 수 없습니다",
    "sidebar.couldNotDelete": "삭제할 수 없습니다",
    "sidebar.couldNotRename": "이름을 바꿀 수 없습니다",
    "sidebar.newChatTitle": "새 채팅",
    "chat.greeting": "안녕하세요, 저는 Sunny예요 ☀",
    "chat.greetingSub": "무엇이든 물어보거나, 아이디어를 함께 떠올려요. 인사만 건네셔도 좋아요.",
    "chat.disclaimer": "Sunny도 실수할 수 있어요. 중요한 정보는 꼭 확인해 주세요.",
    "chat.couldNotLoad": "채팅 기록을 불러올 수 없습니다",
    "chat.couldNotStart": "새 채팅을 시작할 수 없습니다",
    "chat.connectionError": "연결 오류가 발생했습니다. 다시 시도해 주세요.",
    "composer.placeholder": "Sunny에게 메시지 보내기…",
    "composer.send": "보내기",
    "composer.stop": "중지",
    "suggestion.1": "글쓰기 워밍업 주제를 알려줘",
    "suggestion.2": "양자 얽힘을 쉽게 설명해줘",
    "suggestion.3": "리스본에서 보낼 아늑한 주말 계획",
    "suggestion.4": "내 카페 이름 짓기를 도와줘",
    "auth.welcomeBack": "다시 오신 걸 환영합니다",
    "auth.createAccount": "계정 만들기",
    "auth.signInSub": "Sunny와 대화하려면 로그인하세요 ☀",
    "auth.signUpSub": "Sunny와 대화를 시작하려면 가입하세요 ☀",
    "auth.email": "이메일",
    "auth.password": "비밀번호",
    "auth.signIn": "로그인",
    "auth.createBtn": "계정 만들기",
    "auth.pleaseWait": "잠시만 기다려 주세요…",
    "auth.newToSunny": "Sunny가 처음이신가요?",
    "auth.haveAccount": "이미 계정이 있으신가요?",
    "auth.createLink": "계정 만들기",
    "auth.welcomeToast": "Sunny에 오신 걸 환영해요 ☀",
    "auth.somethingWrong": "문제가 발생했습니다",
    "auth.continueWithGoogle": "Google로 계속하기",
    "auth.or": "또는",
    "lang.label": "언어",
    "lang.en": "English",
    "lang.ko": "한국어",
  },
} as const;

export type TKey = keyof (typeof dict)["en"];

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "en" || saved === "ko") return saved;
    return window.navigator.language?.toLowerCase().startsWith("ko") ? "ko" : "en";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const t = (k: TKey) => dict[lang][k] ?? dict.en[k] ?? k;
  return (
    <I18nContext.Provider value={{ lang, setLang: setLangState, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

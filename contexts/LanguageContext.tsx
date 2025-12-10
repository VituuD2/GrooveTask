import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, LanguageCode, Translation } from '../translations';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: Translation;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    // Load initial language from local storage
    const savedLang = localStorage.getItem('groovetask_language') as LanguageCode;
    if (savedLang && translations[savedLang]) {
      setLanguageState(savedLang);
    } else {
      // Try to detect browser language
      const browserLang = navigator.language;
      if (browserLang.startsWith('pt')) setLanguageState('pt-BR');
      else if (browserLang.startsWith('es')) setLanguageState('es');
      else if (browserLang.startsWith('fr')) setLanguageState('fr');
      else if (browserLang.startsWith('de')) setLanguageState('de');
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('groovetask_language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
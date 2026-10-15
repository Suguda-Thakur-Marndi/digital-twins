"use client";

import React, { createContext, useContext, useEffect, ReactNode } from "react";

export type Language = "en" | "hi" | "kn";

export interface TranslationDictionary {
  // Navigation & Branding
  brandName: string;
  tagline: string;
  syntheticLabel: string;
  simulatedLabel: string;
  clinicianView: string;
  patientView: string;
  languageSelect: string;

  // Demographics & Vitals
  patient: string;
  age: string;
  gender: string;
  vitals: string;
  sbp: string;
  dbp: string;
  heartRate: string;
  weight: string;
  bmi: string;
  glucose: string;
  hba1c: string;

  // Risk Tiers
  riskLow: string;
  riskModerate: string;
  riskHigh: string;
  calibratedRisk: string;
  earlyWarning: string;

  // Patient Plain-Language Summary
  patientSummaryTitle: string;
  bpRisingStatement: string;
  bpStableStatement: string;
  bpElevatedStatement: string;
  recommendedQuestionsTitle: string;
  question1: string;
  question2: string;
  question3: string;
  patientDisclaimer: string;

  // Indian Guidelines & Disclaimer
  indianGuidelinesTitle: string;
  indianGuidelinesNote: string;
  populationDisclaimer: string;
  epidemiologyCitation: string;

  // Actions
  printReport: string;
  launchSimulation: string;
  importRecord: string;
  clearSession: string;
}

const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    brandName: "Pramana Clinical Twin",
    tagline: "Longitudinal Digital Twin for 365-Day Hypertension Decompensation",
    syntheticLabel: "SYNTHETIC",
    simulatedLabel: "SIMULATED",
    clinicianView: "Clinician View",
    patientView: "Patient View",
    languageSelect: "Language",

    patient: "Patient",
    age: "Age",
    gender: "Gender",
    vitals: "Current Vitals",
    sbp: "Systolic BP",
    dbp: "Diastolic BP",
    heartRate: "Heart Rate",
    weight: "Body Weight",
    bmi: "Body Mass Index (BMI)",
    glucose: "Fasting Blood Glucose",
    hba1c: "Glycated Hemoglobin (HbA1c)",

    riskLow: "Low Risk",
    riskModerate: "Moderate Risk",
    riskHigh: "High Risk",
    calibratedRisk: "Calibrated 365-Day Risk",
    earlyWarning: "Early Warning Lead Time",

    patientSummaryTitle: "Your Health Twin Summary",
    bpRisingStatement: "Your blood pressure readings have been gradually rising over the last 3 months.",
    bpStableStatement: "Your blood pressure readings have remained relatively stable over recent recordings.",
    bpElevatedStatement: "Your blood pressure is currently in the elevated range requiring clinical review.",
    recommendedQuestionsTitle: "Suggested Questions to Ask Your Doctor",
    question1: "Should we consider adjusting my current blood pressure medication dosage?",
    question2: "What lifestyle modifications or dietary changes (such as lower sodium) would help stabilize my readings?",
    question3: "How frequently should I log home blood pressure readings before our next consultation?",
    patientDisclaimer:
      "This digital twin is a research prototype operating on synthetic data. It does not provide medical diagnoses or prescriptive treatment instructions. Always consult your qualified physician.",

    indianGuidelinesTitle: "Indian Guidelines on Hypertension (IGH-IV / ICMR)",
    indianGuidelinesNote:
      "Threshold of 140/90 mmHg marks hypertension diagnosis under IGH-IV guidelines (JAPI 2019 / ICMR 2021). Target for adults is <140/90 mmHg (<130/80 mmHg in diabetes/CKD).",
    populationDisclaimer:
      "Model trained on synthetic US-style Synthea EHR data. It has not been clinically validated on Indian populations or South Asian phenotypes.",
    epidemiologyCitation:
      "Hypertension affects ~220 million adults in India (ICMR-INDIAB study, Lancet Diabetes & Endocrinol 2023; WHO IHCI Progress Report 2023).",

    printReport: "Print Clinical Report",
    launchSimulation: "Simulate What-If",
    importRecord: "Import Patient Record",
    clearSession: "Clear Session Data",
  },

  hi: {
    brandName: "प्रमाण क्लिनिकल ट्विन",
    tagline: "365-दिवसीय उच्च रक्तचाप जटिलता के लिए अनुदैर्ध्य डिजिटल ट्विन",
    syntheticLabel: "सिंथेटिक डेटा",
    simulatedLabel: "सिम्युलेटेड टेलीमेट्री",
    clinicianView: "चिकित्सक दृश्य (Clinician)",
    patientView: "मरीज दृश्य (Patient)",
    languageSelect: "भाषा",

    patient: "मरीज",
    age: "उम्र",
    gender: "लिंग",
    vitals: "वर्तमान वाइटल्स",
    sbp: "सिस्टोलिक रक्तचाप (SBP)",
    dbp: "डायस्टोलिक रक्तचाप (DBP)",
    heartRate: "हृदय गति (Heart Rate)",
    weight: "वजन (Weight)",
    bmi: "बॉडी मास इंडेक्स (BMI)",
    glucose: "रक्त शर्करा (Glucose)",
    hba1c: "एचबीए1सी (HbA1c)",

    riskLow: "कम जोखिम",
    riskModerate: "मध्यम जोखिम",
    riskHigh: "उच्च जोखिम",
    calibratedRisk: "कैलिब्रेटेड 365-दिन का जोखिम",
    earlyWarning: "प्रारंभिक चेतावनी लीड समय",

    patientSummaryTitle: "आपके स्वास्थ्य ट्विन का सारांश",
    bpRisingStatement: "पिछले 3 महीनों में आपके रक्तचाप के आंकड़े धीरे-धीरे बढ़ रहे हैं।",
    bpStableStatement: "हाल के रिकॉर्ड में आपका रक्तचाप अपेक्षाकृत स्थिर रहा है।",
    bpElevatedStatement: "आपका रक्तचाप वर्तमान में उच्च श्रेणी में है, जिस पर डॉक्टर से परामर्श की आवश्यकता है।",
    recommendedQuestionsTitle: "अपने डॉक्टर से पूछने के लिए अनुशंसित प्रश्न",
    question1: "क्या हमें अपनी वर्तमान रक्तचाप की दवा की खुराक बदलने पर विचार करना चाहिए?",
    question2: "मेरी रीडिंग को स्थिर करने के लिए कौन से जीवनशैली या आहार परिवर्तन (जैसे कम नमक) मदद करेंगे?",
    question3: "हमारे अगले परामर्श से पहले मुझे घर पर कितनी बार रक्तचाप मापना चाहिए?",
    patientDisclaimer:
      "यह डिजिटल ट्विन सिंथेटिक डेटा पर एक शोध प्रोटोटाइप है। यह कोई नैदानिक निदान या चिकित्सीय उपचार निर्देश प्रदान नहीं करता है। हमेशा अपने योग्य चिकित्सक से परामर्श लें।",

    indianGuidelinesTitle: "भारतीय उच्च रक्तचाप दिशानिर्देश (IGH-IV / ICMR)",
    indianGuidelinesNote:
      "IGH-IV दिशानिर्देशों (JAPI 2019 / ICMR 2021) के अनुसार 140/90 mmHg उच्च रक्तचाप का मानक है। वयस्कों के लिए लक्ष्य <140/90 mmHg है।",
    populationDisclaimer:
      "मॉडल सिंथेटिक अमेरिकी शैली के सिंथिया ईएचआर डेटा पर प्रशिक्षित है। यह भारतीय आबादी या दक्षिण एशियाई फेनोटाइप पर मान्य नहीं है।",
    epidemiologyCitation:
      "भारत में लगभग 22 करोड़ वयस्क उच्च रक्तचाप से प्रभावित हैं (ICMR-INDIAB अध्ययन, लैंसेट डायबिटीज एंड एंडोक्रिनोलॉजी 2023)।",

    printReport: "रिपोर्ट प्रिंट करें",
    launchSimulation: "सिम्युलेशन चलाएं",
    importRecord: "मरीज रिकॉर्ड आयात करें",
    clearSession: "सत्र डेटा साफ करें",
  },

  kn: {
    brandName: "ಪ್ರಮಾಣ ಕ್ಲಿನಿಕಲ್ ಟ್ವಿನ್",
    tagline: "365-ದಿನಗಳ ಅಧಿಕ ರಕ್ತದೊತ್ತಡದ ತೊಡಕುಗಳಿಗಾಗಿ ಡಿಜಿಟಲ್ ಟ್ವಿನ್",
    syntheticLabel: "ಸಿಂಥೆಟಿಕ್ ಡೇಟಾ",
    simulatedLabel: "ಸಿಮ್ಯುಲೇಟೆಡ್ ಟೆಲಿಮೆಟ್ರಿ",
    clinicianView: "ವೈದ್ಯರ ನೋಟ (Clinician)",
    patientView: "ರೋಗಿಯ ನೋಟ (Patient)",
    languageSelect: "ಭಾಷೆ",

    patient: "ರೋಗಿ",
    age: "ವಯಸ್ಸು",
    gender: "ಲಿಂಗ",
    vitals: "ಪ್ರಸ್ತುತ ಪ್ರಮುಖ ಅಂಕಿಅಂಶಗಳು",
    sbp: "ಸಿಸ್ಟೊಲಿಕ್ ರಕ್ತದೊತ್ತಡ (SBP)",
    dbp: "ಡಯಾಸ್ಟೊಲಿಕ್ ರಕ್ತದೊತ್ತಡ (DBP)",
    heartRate: "ಹೃದಯ ಬಡಿತ (HR)",
    weight: "ತೂಕ (Weight)",
    bmi: "ಬಾಡಿ ಮಾಸ್ ಇಂಡೆಕ್ಸ್ (BMI)",
    glucose: "ರಕ್ತದಲ್ಲಿನ ಸಕ್ಕರೆ (Glucose)",
    hba1c: "ಎಚ್‌ಬಿಎ1ಸಿ (HbA1c)",

    riskLow: "ಕಡಿಮೆ ಅಪಾಯ",
    riskModerate: "ಮಧ್ಯಮ ಅಪಾಯ",
    riskHigh: "ಹೆಚ್ಚು ಅಪಾಯ",
    calibratedRisk: "ಕ್ಯಾಲಿಬ್ರೇಟ್ ಮಾಡಿದ 365-ದಿನಗಳ ಅಪಾಯ",
    earlyWarning: "ಮುಂಚಿನ ಎಚ್ಚರಿಕೆ ಲೀಡ್ ಸಮಯ",

    patientSummaryTitle: "ನಿಮ್ಮ ಆರೋಗ್ಯ ಟ್ವಿನ್ ಸಾರಾಂಶ",
    bpRisingStatement: "ಕಳೆದ 3 ತಿಂಗಳುಗಳಿಂದ ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡದ ಅಂಕಿಅಂಶಗಳು ಕ್ರಮೇಣ ಹೆಚ್ಚಾಗುತ್ತಿವೆ.",
    bpStableStatement: "ಇತ್ತೀಚಿನ ದಾಖಲೆಗಳಲ್ಲಿ ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡವು ಸ್ಥಿರವಾಗಿದೆ.",
    bpElevatedStatement: "ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡವು ಪ್ರಸ್ತುತ ಹೆಚ್ಚಿದ ವ್ಯಾಪ್ತಿಯಲ್ಲಿದೆ ಮತ್ತು ವೈದ್ಯರ ತಪಾಸಣೆ ಅಗತ್ಯವಿದೆ.",
    recommendedQuestionsTitle: "ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಕೇಳಲು ಶಿಫಾರಸು ಮಾಡಲಾದ ಪ್ರಶ್ನೆಗಳು",
    question1: "ನನ್ನ ಪ್ರಸ್ತುತ ರಕ್ತದೊತ್ತಡದ ಔಷಧಿಯ ಪ್ರಮಾಣವನ್ನು ಬದಲಾಯಿಸಲು ನಾವು ಪರಿಗಣಿಸಬೇಕೇ?",
    question2: "ನನ್ನ ರೀಡಿಂಗ್‌ಗಳನ್ನು ಸ್ಥಿರಗೊಳಿಸಲು ಯಾವ ಜೀವನಶೈಲಿ ಅಥವಾ ಆಹಾರ ಬದಲಾವಣೆಗಳು (ಉದಾಹರಣೆಗೆ ಕಡಿಮೆ ಉಪ್ಪು) ಸಹಾಯ ಮಾಡುತ್ತವೆ?",
    question3: "ನಮ್ಮ ಮುಂದಿನ ಸಮಾಲೋಚನೆಯ ಮೊದಲು ನಾನು ಎಷ್ಟು ಬಾರಿ ಮನೆಯಲ್ಲಿ ರಕ್ತದೊತ್ತಡವನ್ನು ಅಳೆಯಬೇಕು?",
    patientDisclaimer:
      "ಈ ಡಿಜಿಟಲ್ ಟ್ವಿನ್ ಸಿಂಥೆಟಿಕ್ ಡೇಟಾದ ಮೇಲಿನ ಸಂಶೋಧನಾ ಮೂಲಮಾದರಿಯಾಗಿದೆ. ಇದು ರೋಗನಿರ್ಣಯ ಅಥವಾ ವೈದ್ಯಕೀಯ ಚಿಕಿತ್ಸೆಯ ಸಲಹೆಯಲ್ಲ. ಯಾವಾಗಲೂ ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.",

    indianGuidelinesTitle: "ಭಾರತೀಯ ಅಧಿಕ ರಕ್ತದೊತ್ತಡ ಮಾರ್ಗಸೂಚಿಗಳು (IGH-IV / ICMR)",
    indianGuidelinesNote:
      "IGH-IV ಮಾರ್ಗಸೂಚಿಗಳ (JAPI 2019 / ICMR 2021) ಪ್ರಕಾರ 140/90 mmHg ರಕ್ತದೊತ್ತಡದ ರೋಗನಿರ್ಣಯ ಮಿತಿಯಾಗಿದೆ. ವಯಸ್ಕರಿಗೆ ಗುರಿ <140/90 mmHg.",
    populationDisclaimer:
      "ಮಾದರಿಯನ್ನು ಅಮೆರಿಕನ್ ಶೈಲಿಯ ಸಿಂಥಿಯಾ ಇಹೆಚ್‌ಆರ್ ಡೇಟಾದಲ್ಲಿ ತರಬೇತುಗೊಳಿಸಲಾಗಿದೆ. ಭಾರತೀಯ ಜನಸಂಖ್ಯೆಯಲ್ಲಿ ಇದನ್ನು ಮೌಲ್ಯೀಕರಿಸಲಾಗಿಲ್ಲ.",
    epidemiologyCitation:
      "ಭಾರತದಲ್ಲಿ ಸುಮಾರು 22 ಕೋಟಿ ವಯಸ್ಕರು ಅಧಿಕ ರಕ್ತದೊತ್ತಡದಿಂದ ಬಳಲುತ್ತಿದ್ದಾರೆ (ICMR-INDIAB ಅಧ್ಯಯನ, ಲ್ಯಾನ್ಸೆಟ್ 2023).",

    printReport: "ವರದಿಯನ್ನು ಮುದ್ರಿಸಿ",
    launchSimulation: "ಸಿಮ್ಯುಲೇಶನ್ ರನ್ ಮಾಡಿ",
    importRecord: "ದಾಖಲೆ ಆಮದು ಮಾಡಿ",
    clearSession: "ಸೆಷನ್ ಡೇಟಾ ತೆರವುಗೊಳಿಸಿ",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: TRANSLATIONS.en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language: Language = "en";

  useEffect(() => {
    try {
      localStorage.setItem("twincare_language", "en");
    } catch {
      // localStorage may not be available during SSR
    }
  }, []);

  const setLanguage = () => {
    // Language locked to English only
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: TRANSLATIONS.en }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

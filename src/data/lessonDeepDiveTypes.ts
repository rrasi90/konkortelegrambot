export interface DeepDiveSection {
  title: string;
  /** متن آموزشی؛ می‌تواند شامل فرمول‌های $...$ باشد */
  body: string;
}

export interface DeepDiveExample {
  prompt: string;
  steps: string[];
  answer: string;
}

export interface LessonDeepDive {
  nodeId: string;
  objectives: string[];
  whyItMatters: string;
  sections: DeepDiveSection[];
  example: DeepDiveExample;
  misconceptions: string[];
  examAngle: string;
  takeaways: string[];
}

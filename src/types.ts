export enum TopicType {
  WORK_STUDY = "工作与学业",
  HOMETOWN = "我的家乡",
  HOBBIES_LEISURE = "兴趣与休闲",
  DAILY_ROUTINES = "日常作息",
  TRAVEL_TOURISM = "旅游与出行",
  TECHNOLOGY = "科学技术",
  ENVIRONMENT = "自然与环境"
}

export type IELTSPhase = "idle" | "part1" | "part2" | "part3" | "completed" | "evaluating" | "results";

export interface DialogueTurn {
  id: string;
  sender: "host" | "user";
  text: string;
  timestamp: string;
  part: 1 | 2 | 3;
}

export interface GrammaticalError {
  original: string;
  correction: string;
  explanation: string;
  offset: number; // Approximate word index or character position
  length: number;
}

export interface EvaluatedAnswers {
  part1Text: string;
  part2Text: string;
  part3Text: string;
  part1AnnotatedHtml: string;
  part2AnnotatedHtml: string;
  part3AnnotatedHtml: string;
  errors: {
    original: string;
    correction: string;
    explanation: string;
    context: string;
    part: 1 | 2 | 3;
  }[];
}

export interface CriteriaMetrics {
  score: number;
  strength: string;
  weakness: string;
  suggestion: string;
}

export interface IELTSReport {
  overallScore: number;
  feedbackSummary: string;
  fluencyAndCoherence: CriteriaMetrics;
  lexicalResource: CriteriaMetrics;
  grammaticalRangeAndAccuracy: CriteriaMetrics;
  pronunciation: CriteriaMetrics;
  answers: EvaluatedAnswers;
  durationSeconds: number;
}

export interface PartConfig {
  partNumber: 1 | 2 | 3;
  title: string;
  description: string;
  recommendedDuration: string; // e.g., "4-5 mins", "3-4 mins"
}

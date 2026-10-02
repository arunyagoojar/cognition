/**
 * Canonical Content Architecture Type Definitions for Cognition IELTS
 * Strict type safety for content packages, question groups, answer keys,
 * source evidence, authentic manifests, and dynamic practice generation.
 */

export type ValidationStatus = 'UNVERIFIED' | 'VALIDATING' | 'VERIFIED' | 'FAILED' | 'NEEDS_REVIEW';

export type SkillType = 'listening' | 'reading' | 'writing' | 'speaking';

export type ExtractionMethod = 'native_pdf' | 'ocr_vision' | 'hybrid' | 'manual_verified';

export type TextComparisonResult = 
  | 'EXACT_MATCH' 
  | 'NORMALIZED_MATCH' 
  | 'MINOR_EXTRACTION_DIFFERENCE' 
  | 'AMBIGUOUS' 
  | 'FAIL';

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SourceEvidence {
  sourceFile: string;
  sourceFileHash?: string;
  sourcePage: number;
  sourceBoundingBox?: BoundingBox;
  originalExtractedText: string;
  normalizedText: string;
  extractionMethod: ExtractionMethod;
  extractionConfidence: number; // 0.0 to 1.0
  notes?: string;
}

export interface AnswerNormalizationRules {
  caseSensitive?: boolean;
  allowArticles?: boolean;
  allowPluralVariants?: boolean;
  numericTolerance?: number;
  trimPunctuation?: boolean;
  allowedSeparators?: string[];
}

export interface AnswerDefinition {
  primaryAnswer: string;
  acceptedAnswers: string[];
  answerType: 'text' | 'number' | 'single_choice' | 'multiple_choice' | 'boolean';
  normalizationRules?: AnswerNormalizationRules;
  explanation?: string;
}

export interface CanonicalQuestion {
  id: string; // e.g. CAM14-T4-L-S1-Q01
  questionNumber: number;
  type: 'fill' | 'mcq' | 'matching' | 'tfng' | 'yesno';
  prompt: string;
  prefix?: string;
  suffix?: string;
  options?: string[];
  answer: AnswerDefinition;
  sourceEvidence?: SourceEvidence;
}

export type QuestionGroupType = 
  | 'multiple_choice'
  | 'matching'
  | 'form_completion'
  | 'note_completion'
  | 'table_completion'
  | 'flow_chart_completion'
  | 'sentence_completion'
  | 'map_labeling'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'summary_completion'
  | 'diagram_labeling'
  | 'short_answer';

export interface QuestionGroup {
  id: string; // e.g. CAM14-T4-L-S1-G01
  type: QuestionGroupType;
  instructions: string;
  questionRange: [number, number]; // [startQ, endQ] inclusive
  questions: CanonicalQuestion[];
  options?: string[];
  sourceEvidence?: SourceEvidence;
}

export interface PackageValidation {
  status: ValidationStatus;
  lastValidatedAt: string;
  errors?: string[];
  warnings?: string[];
}

export interface ListeningAudioMetadata {
  file: string; // e.g. "/audio/cambridge14_test4_part1.mp3"
  hash?: string;
  durationSeconds?: number;
  bitrate?: number;
}

export interface ListeningSectionPackage {
  id: string; // e.g. CAM14-T4-L-S1
  skill: 'listening';
  sourceTestId: string; // e.g. CAM14-T4
  sectionNumber: 1 | 2 | 3 | 4;
  title: string;
  context?: string;
  audio: ListeningAudioMetadata;
  transcript: string;
  questionRange: [number, number];
  questionGroups: QuestionGroup[];
  answerKey: Record<string, AnswerDefinition>;
  sourceEvidence?: SourceEvidence;
  validation: PackageValidation;
}

export interface ReadingPassagePackage {
  id: string; // e.g. CAM14-T4-R-P1
  skill: 'reading';
  sourceTestId: string; // e.g. CAM14-T4
  passageNumber: 1 | 2 | 3;
  title: string;
  passageText: string;
  questionRange: [number, number];
  questionGroups: QuestionGroup[];
  answerKey: Record<string, AnswerDefinition>;
  sourceEvidence?: SourceEvidence;
  validation: PackageValidation;
}

export interface WritingTaskImage {
  file: string; // e.g. "/images/cambridge14_test4_task1.png"
  description?: string;
  alt?: string;
  sourceEvidence?: SourceEvidence;
}

export interface WritingTaskPackage {
  id: string; // e.g. CAM14-T4-W-T1
  skill: 'writing';
  sourceTestId: string; // e.g. CAM14-T4
  taskNumber: 1 | 2;
  taskType: 'academic_report' | 'discursive_essay';
  title: string;
  prompt: string;
  image?: WritingTaskImage;
  minWords: number;
  modelAnswer?: string;
  sourceEvidence?: SourceEvidence;
  validation: PackageValidation;
}

export interface CueCard {
  topic: string;
  bulletPoints: string[];
  prepTimeSeconds: number;
  speakTimeSeconds: number;
}

export interface SpeakingPartPackage {
  id: string; // e.g. CAM14-T4-S-P1
  skill: 'speaking';
  sourceTestId: string; // e.g. CAM14-T4
  partNumber: 1 | 2 | 3;
  topic: string;
  questions: string[];
  cueCard?: CueCard;
  followUpQuestions?: string[];
  sourceEvidence?: SourceEvidence;
  validation: PackageValidation;
}

export interface SpeakingTestPackage {
  id: string; // e.g. CAM14-T4-S
  sourceTestId: string;
  theme: string;
  title: string;
  parts: [SpeakingPartPackage, SpeakingPartPackage, SpeakingPartPackage];
  validation: PackageValidation;
}

export interface AuthenticTestManifest {
  testId: string; // e.g. CAM14-T4
  contentVersion: string;
  source: {
    publisher: 'Cambridge Assessment English' | 'Cambridge University Press';
    book: number;
    testNumber: number;
    label: string;
  };
  listening: [string, string, string, string]; // Immutable Section IDs [S1, S2, S3, S4]
  reading: [string, string, string]; // Immutable Passage IDs [P1, P2, P3]
  writing: [string, string]; // Immutable Task IDs [T1, T2]
  speaking: [string, string, string]; // Immutable Part IDs [P1, P2, P3]
  validationStatus: ValidationStatus;
}

export interface DynamicPracticeTest {
  practiceTestId: string;
  seed: number;
  generatorVersion: string;
  contentVersion: string;
  generatedAt: string;
  selectedPackageIds: {
    listening?: [string, string, string, string];
    reading?: [string, string, string];
    writing?: [string, string];
    speaking?: [string, string, string];
  };
  validationStatus: ValidationStatus;
}

export interface FullTestReconstructionReport {
  testId: string;
  status: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
  sectionsChecked: {
    listening: boolean;
    reading: boolean;
    writing: boolean;
    speaking: boolean;
  };
  totalQuestions: number;
  expectedQuestions: number;
  assetDiscrepancies: string[];
  schemaErrors: string[];
  verifiedAt: string;
}

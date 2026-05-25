import React, { useState, useEffect } from "react";
import { IELTSReport, CriteriaMetrics } from "../types";
import { 
  Award, 
  BookOpen, 
  CheckCircle, 
  Compass, 
  HelpCircle, 
  RefreshCw, 
  ChevronRight, 
  AlertCircle, 
  Sparkles, 
  VolumeX, 
  Check, 
  FileText,
  User,
  ExternalLink 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface IELTSEvaluationPanelProps {
  report: IELTSReport;
  onRestart: () => void;
}

export default function IELTSEvaluationPanel({ report, onRestart }: IELTSEvaluationPanelProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "part1" | "part2" | "part3" | "grammar">("summary");
  const [selectedError, setSelectedError] = useState<{
    original: string;
    correction: string;
    explanation: string;
    context?: string;
  } | null>(null);

  // Hook up event listeners inside the generated annotated HTML so clicking errors opens the hover inspect card
  useEffect(() => {
    const handleHtmlClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const errorSpan = target.closest(".ielts-error");
      if (errorSpan) {
        const original = errorSpan.getAttribute("data-original") || "";
        const correction = errorSpan.getAttribute("data-correction") || "";
        const explanation = errorSpan.getAttribute("data-explanation") || "";
        setSelectedError({ original, correction, explanation });
      }
    };

    document.addEventListener("click", handleHtmlClick);
    return () => document.removeEventListener("click", handleHtmlClick);
  }, []);

  const getScoreColorClass = (score: number) => {
    if (score >= 7.5) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    if (score >= 6.5) return { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" };
    if (score >= 5.5) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
  };

  const getBandLevelName = (score: number) => {
    if (score >= 8.5) return "专家水平 (Excellent User)";
    if (score >= 7.5) return "非常优秀 (Very Good User)";
    if (score >= 6.5) return "合格水平 (Competent User)";
    if (score >= 5.5) return "基础常规水平 (Modest User)";
    return "学业亟待备考阶段 (Basic Speaker)";
  };

  const criteriaList = [
    { key: "FC", title: "流利度与连贯性 (Fluency & Coherence)", data: report.fluencyAndCoherence, desc: "逻辑性强的句段组织、自然合理的流利表达速度以及转折连接词的得体使用。" },
    { key: "LR", title: "词汇多样性与准确性 (Lexical Resource)", data: report.lexicalResource, desc: "词汇使用的广度、对固定搭配的掌握程度、多样化同义改写和替换能力。" },
    { key: "GRA", title: "语法多样性与准确性 (Grammar Range & Accuracy)", data: report.grammaticalRangeAndAccuracy, desc: "多样化复杂句式的结构搭建能力、时态精准度，以及系统性语法的正确度。" },
    { key: "PR", title: "发音与语言面貌 (Pronunciation)", data: report.pronunciation, desc: "母语级别的吐字清晰度、重读和连读的长弱规律，以及持续的发音连贯性。" },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 fade-in select-none" id="ielts-evaluation-panel-root">
      {/* Top Banner and Score Header */}
      <div className="bg-gradient-to-br from-[#f2efeb] to-[#e6e2db] rounded-3xl p-8 border border-[#dfdbd5] shadow-xs mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 border border-white/20 rounded-full text-xs font-semibold text-[#5a5650] mb-3">
            <Award className="h-3.5 w-3.5 text-emerald-600" />
            <span>官方雅思口语标准智能诊断报告 • 已成功汉化</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#2d2a26] mb-2 tracking-tight">雅思口试诊断报告</h1>
          <p className="text-sm text-[#6e6860] max-w-lg mb-0 leading-relaxed">
            口试实练耗时：<span className="font-semibold text-[#2d2a26]">{Math.floor(report.durationSeconds / 60)} 分 {report.durationSeconds % 60} 秒</span>。
            非常棒的主题练习！您本次练习的各评测维度细则与口语错词批改列表如下：
          </p>
        </div>

        {/* Global Circle Score Badge */}
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-[#ede9e2] shadow-sm min-w-[200px]">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">雅思预估得分</span>
          <div className="relative my-2 flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-slate-100 fill-none"
                strokeWidth="8"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-emerald-500 fill-none transition-all duration-1000 ease-out"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - report.overallScore / 9)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-slate-800 tracking-tighter">{report.overallScore.toFixed(1)}</span>
              <span className="text-[10px] text-slate-400 font-bold">考官预估 (满分 9.0)</span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full mt-1 border border-emerald-100">
            {getBandLevelName(report.overallScore)}
          </span>
        </div>
      </div>

      {/* Grid: Details on Left, Metrics Breakdown on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN (Dialogue views, annotated transcripts & corrections) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            
            {/* Tabs Selector Bar */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-5 py-4 text-xs font-bold text-slate-700 border-b-2 tracking-wider transition-all whitespace-nowrap ${
                  activeTab === "summary"
                    ? "border-emerald-500 text-emerald-800 bg-white"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                考官学术总评
              </button>
              <button
                onClick={() => setActiveTab("part1")}
                className={`px-5 py-4 text-xs font-bold text-slate-700 border-b-2 tracking-wider transition-all whitespace-nowrap ${
                  activeTab === "part1"
                    ? "border-emerald-500 text-emerald-800 bg-white"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                Part 1 原文批改
              </button>
              <button
                onClick={() => setActiveTab("part2")}
                className={`px-5 py-4 text-xs font-bold text-slate-700 border-b-2 tracking-wider transition-all whitespace-nowrap ${
                  activeTab === "part2"
                    ? "border-emerald-500 text-emerald-800 bg-white"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                Part 2 原文批改
              </button>
              <button
                onClick={() => setActiveTab("part3")}
                className={`px-5 py-4 text-xs font-bold text-slate-700 border-b-2 tracking-wider transition-all whitespace-nowrap ${
                  activeTab === "part3"
                    ? "border-emerald-500 text-emerald-800 bg-white"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                Part 3 原文批改
              </button>
              <button
                onClick={() => setActiveTab("grammar")}
                className={`px-5 py-4 text-xs font-bold text-slate-700 border-b-2 tracking-wider transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === "grammar"
                    ? "border-emerald-500 text-emerald-800 bg-white"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                名师诊断纠错本 ({report.answers.errors.length})
              </button>
            </div>

            {/* Tap Panel Body */}
            <div className="p-6 md:p-8">
              
              {/* Tab: Summary */}
              {activeTab === "summary" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-600" />
                      考官总评与诊断
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed font-sans whitespace-pre-line bg-[#fbfbfa] p-4 rounded-xl border border-slate-100">
                      {report.feedbackSummary}
                    </p>
                  </div>

                  <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100 flex gap-4">
                    <Compass className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 mb-1">交互式名师双语纠错功能说明</h4>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        点击上方的 <b>“Part 1, 2, 3 原文批改”</b>，所有发现的词汇、句式及不妥语法均以<b>醒目的红色下划线高亮显示</b>。您可以<b>直接用鼠标点击红色高亮文本</b>，即可在下方快速展开由雅思名师提供的中文语法纠正及精辟解析！
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: IELTS Part 1 */}
              {activeTab === "part1" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 text-emerald-800 font-semibold px-4 py-2.5 rounded-lg border border-emerald-100 text-sm">
                    Part 1 核心：日常话题趣味热身问答
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">已批改的口语记录文本 (点击红色部分查看名师分析)</h4>
                    <div 
                      className="text-sm text-slate-700 leading-relaxed font-sans prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: report.answers.part1AnnotatedHtml || report.answers.part1Text }}
                    />
                  </div>
                </div>
              )}

              {/* Tab: IELTS Part 2 */}
              {activeTab === "part2" && (
                <div className="space-y-5">
                  <div className="bg-teal-50 text-teal-800 font-semibold px-4 py-2.5 rounded-lg border border-teal-100 text-sm">
                    Part 2 核心：1-2分钟完整独白卡片描述
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">已批改的口语记录文本 (点击红色部分查看名师分析)</h4>
                    <div 
                      className="text-sm text-slate-700 leading-relaxed font-sans prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: report.answers.part2AnnotatedHtml || report.answers.part2Text }}
                    />
                  </div>
                </div>
              )}

              {/* Tab: IELTS Part 3 */}
              {activeTab === "part3" && (
                <div className="space-y-5">
                  <div className="bg-violet-50 text-violet-800 font-semibold px-4 py-2.5 rounded-lg border border-violet-100 text-sm">
                    Part 3 核心：深度探究及抽象思维推导拓展
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">已批改的口语记录文本 (点击红色部分查看名师分析)</h4>
                    <div 
                      className="text-sm text-slate-700 leading-relaxed font-sans prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: report.answers.part3AnnotatedHtml || report.answers.part3Text }}
                    />
                  </div>
                </div>
              )}

              {/* Tab: Flattened Error Logs */}
              {activeTab === "grammar" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#2d2a26] bg-[#f2efeb] px-3 py-1 rounded-full border border-slate-250">
                      共定位到 {report.answers.errors.length} 处语法词汇瑕疵
                    </span>
                  </div>

                  {report.answers.errors.length === 0 ? (
                    <div className="text-center py-10 bg-emerald-50 rounded-xl border border-emerald-100">
                      <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                      <p className="font-serif text-lg font-bold text-slate-800">完美！语法与用词极其纯正</p>
                      <p className="text-xs text-emerald-700 mt-1">您在此次口试练习中展现了极高的语法精确度与高级句式组织熟练度。</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                      {report.answers.errors.map((err, idx) => (
                        <div key={idx} className="p-4 hover:bg-slate-50 transition flex flex-col md:flex-row justify-between gap-4">
                          <div className="max-w-xl">
                            <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2">
                              Part {err.part} 原文定位
                            </span>
                            <blockquote className="text-xs text-slate-400 italic mb-2 border-l-2 border-slate-200 pl-2">
                              "... {err.context} ..."
                            </blockquote>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-xs line-through text-rose-500 bg-rose-50 px-2 py-0.5 rounded font-bold">{err.original}</span>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                              <span className="text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold">{err.correction}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed font-bold">{err.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inspector Card for Clicking Errors */}
              <AnimatePresence>
                {selectedError && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="mt-6 bg-[#fff6f6] border border-[#f5c6c6] rounded-xl p-5 flex items-start gap-4 relative shadow-sm"
                  >
                    <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 pr-6">
                      <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                        <span>语法词汇纠错诊断</span>
                        <span className="text-xs font-bold line-through text-rose-400">"{selectedError.original}"</span>
                      </h4>
                      <div className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 inline-block px-2.5 py-1 rounded border border-emerald-100 mb-2">
                        推荐改进写法：<span className="font-bold underline">{selectedError.correction}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-bold">
                        解析：{selectedError.explanation}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedError(null)}
                      className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold bg-white/50 h-6 w-6 rounded-full flex items-center justify-center border border-slate-100 shadow-xs"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

          {/* Quick suggestions block */}
          <div className="bg-[#f0f9ff]/60 border border-[#bce3ff] rounded-2xl p-6 flex gap-4">
            <Compass className="h-6 w-6 text-[#1d82f5] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#0c4a8a]">雅思考试评测说明贴士</h4>
              <p className="text-xs text-[#2b6cb0] leading-relaxed mt-1">
                本报告的雅思估分完全对齐雅思官方四大基准判分细则（流利与连贯、词汇多样性、语法多样性与发音）。建议您通过多维度雅思主题高频真题定期自测，锻炼长难句输出与即兴应答能力，实现更高梯度的成绩突破。
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Individual metrics descriptors) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <h2 className="font-serif text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              四大核心维度拆解表
            </h2>

            <div className="space-y-6">
              {criteriaList.map((crit, idx) => {
                const colors = getScoreColorClass(crit.data.score);
                return (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                        {crit.key} • {crit.title}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}>
                        得分 Band {crit.data.score.toFixed(1)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                      {crit.desc}
                    </p>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">优势亮点 (Strength)</div>
                        <p className="text-xs text-slate-700 leading-relaxed mt-0.5 font-medium">{crit.data.strength}</p>
                      </div>
                      <div className="pt-1.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">改进空间 (Weakness)</div>
                        <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{crit.data.weakness}</p>
                      </div>
                      <div className="pt-1.5 border-t border-dashed border-slate-200/60 mt-2">
                        <div className="text-[10px] text-emerald-500 font-bold uppercase">备考官精准解析 (Examiner Advice)</div>
                        <p className="text-xs text-emerald-800 leading-relaxed mt-0.5 font-medium">{crit.data.suggestion}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action button to replay */}
          <button
            onClick={onRestart}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-md text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <RefreshCw className="h-4.5 w-4.5" /> 开启下一轮真题实练
          </button>
        </div>

      </div>
    </div>
  );
}

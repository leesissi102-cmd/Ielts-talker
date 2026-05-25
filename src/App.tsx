import React, { useState, useEffect, useRef } from "react";
import { 
  TopicType, 
  IELTSPhase, 
  DialogueTurn, 
  IELTSReport, 
  PartConfig 
} from "./types";
import CameraRecorder from "./components/CameraRecorder";
import IELTSEvaluationPanel from "./components/IELTSEvaluationPanel";
import { 
  Award, 
  Compass, 
  Video, 
  Mic, 
  Sparkles, 
  FileText, 
  ChevronRight, 
  ArrowRight, 
  CheckCircle, 
  HelpCircle, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Users, 
  UserPlus, 
  Play, 
  RotateCcw, 
  Clock, 
  MessageSquare,
  BookOpen,
  Send,
  Loader,
  Notebook
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface IELTSPracticeMaterials {
  part1Questions: string[];
  part2CueCard: {
    topic: string;
    bullets: string[];
    advice: string;
  };
  part3Questions: string[];
}

export default function App() {
  const [phase, setPhase] = useState<IELTSPhase>("idle");
  const [selectedTopic, setSelectedTopic] = useState<TopicType>(TopicType.HOBBIES_LEISURE);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // IELTS State
  const [materials, setMaterials] = useState<IELTSPracticeMaterials | null>(null);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [dialogueLog, setDialogueLog] = useState<DialogueTurn[]>([]);
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3>(1);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  
  // Timer settings
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes standard
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [part2Preparing, setPart2Preparing] = useState(false);

  // Client speech-to-text handler
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [cumulativeSpeech, setCumulativeSpeech] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  // Live prompt/overlay states
  const [liveOverlayText, setLiveOverlayText] = useState<string | null>(null);
  const [isOverlayLoading, setIsOverlayLoading] = useState(false);
  
  // Practice notes (Part 2 cue card notepad)
  const [practiceNotes, setPracticeNotes] = useState("");

  // Loading indicator messages for calculation phase
  const [evaluationFeedback, setEvaluationFeedback] = useState("Analyzing speaking flow...");
  const [report, setReport] = useState<IELTSReport | null>(null);
  const [overallSeconds, setOverallSeconds] = useState(0);

  // Total Practice Clock
  useEffect(() => {
    let interval: any = null;
    if (phase === "part1" || phase === "part2" || phase === "part3") {
      interval = setInterval(() => {
        setOverallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  // Handle countdown timers
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (isTimerActive && timeRemaining === 0) {
      setIsTimerActive(false);
      if (phase === "part2" && part2Preparing) {
        // Preparation finished, transition to speaking
        startPart2Speaking();
      } else {
        advanceWorkflow();
      }
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeRemaining]);

  // Set up browser speech-to-text when recording starts
  const startSpeechRecognition = () => {
    try {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        console.warn("SpeechRecognition not supported in this browser. Fallback automated triggers will act instead.");
        startSilentFallbackTimer();
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log("Speech recognition matching started.");
        setLiveTranscript("");
        setInterimTranscript("");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setLiveTranscript((prev) => {
            const next = prev + final;
            // Send to Gemini dynamically to simulate active listening response
            triggerLiveGeminiFeedback(next);
            return next;
          });
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
      };

      recognition.onend = () => {
        if (isRecording) {
          // Restart to keep listening actively
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Failed to boot speech recognition:", e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  };

  // If user says nothing or speechrecognition is unsupported, trigger automated podcast conversational inputs so user is NEVER stuck!
  const fallbackTimeoutRef = useRef<any>(null);
  const startSilentFallbackTimer = () => {
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(() => {
      if (isRecording && !liveOverlayText) {
        setLiveOverlayText("Host tips: Describe your personal experience or talk about how it impacts your community.");
      }
    }, 18000); // 18 seconds without interruption
  };

  // Call server to trigger conversational interjections based on what user has spoken
  const triggerLiveGeminiFeedback = async (speechText: string) => {
    if (speechText.trim().split(" ").length < 6) return; // wait for reasonable sentence depth
    
    // Clear fallback timer
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);

    // Limit active requests to prevent API overload
    if (isOverlayLoading) return;
    setIsOverlayLoading(true);

    try {
      const activePrompt = getActivePromptText();
      const response = await fetch("/api/live-listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: speechText,
          activeQuestion: activePrompt,
          currentPart: currentPart,
          history: dialogueLog
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.hostResponse) {
          setLiveOverlayText(result.hostResponse);
          // Highlight overlay feedback and clear after 8 seconds
          setTimeout(() => {
            setLiveOverlayText(null);
          }, 8500);
        }
      }
    } catch (e) {
      console.warn("Live listener overlay call failed:", e);
    } finally {
      setIsOverlayLoading(false);
      // Restart fallback timer
      startSilentFallbackTimer();
    }
  };

  const getActivePromptText = (): string => {
    if (!materials) return "";
    if (currentPart === 1) return materials.part1Questions[activeQuestionIndex] || "";
    if (currentPart === 2) return materials.part2CueCard.topic;
    return materials.part3Questions[activeQuestionIndex] || "";
  };

  // Start the actual practice
  // Start the actual practice
  const handleInitiatePractice = async () => {
    setMaterialsLoading(true);
    setDialogueLog([]);
    setOverallSeconds(0);
    try {
      const res = await fetch("/api/init-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic })
      });

      if (!res.ok) throw new Error("Failed to initialize practice files");
      const data = await res.json();
      setMaterials(data);

      // Add examiner's first introduction prompt to diálogo log
      const firstQuestion = data.part1Questions[0];
      setDialogueLog([
        {
          id: "welcome-prompt",
          sender: "host",
          text: `Welcome to your IELTS Speaking mock test. Let's start with Part 1. I'm going to ask you some questions about yourself and your choices regarding "${selectedTopic}". First question: ${firstQuestion}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          part: 1
        }
      ]);

      setPhase("part1");
      setCurrentPart(1);
      setActiveQuestionIndex(0);
      setTimeRemaining(120); // 2 minutes to answer Part 1 warm ups
      setIsTimerActive(true);
      setIsRecording(true); // Automatically starts recording!
    } catch (err) {
      console.error(err);
      alert("Failed to load topic configuration. Please verify connectivity or server state.");
    } finally {
      setMaterialsLoading(false);
    }
  };

  // Handle transition events for video recording start/stop
  const handleRecordingStarted = () => {
    setIsRecording(true);
    setLiveTranscript("");
    setInterimTranscript("");
    startSpeechRecognition();
  };

  const handleRecordingStopped = (blob: Blob | null) => {
    setIsRecording(false);
    stopSpeechRecognition();
    
    // Save standard response text to Dialogue log
    const userWords = liveTranscript.trim() || "(Quiet thinking and paused responses)";
    
    // Check if we already logged this answer
    const activePrompt = getActivePromptText();
    const updatedLog = [
      ...dialogueLog,
      {
        id: `user-answer-pt${currentPart}-${Date.now()}`,
        sender: "user" as const,
        text: userWords,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        part: currentPart
      }
    ];
    setDialogueLog(updatedLog);

    // Save answer into cumulative store
    setCumulativeSpeech((prev) => [...prev, userWords]);

    // Automatically transition to next question after recording ends
    proceedToNextQuestion(updatedLog);
  };

  const triggerManuelHostPrompt = () => {
    if (!isRecording) return;
    setLiveOverlayText("Evaluating speaking pace... Tell me more about what you like and dislike here!");
    setTimeout(() => setLiveOverlayText(null), 6000);
  };

  const proceedToNextQuestion = (currentLog: typeof dialogueLog) => {
    if (currentPart === 1) {
      // Move to next question in Part 1 or proceed to Part 2 cue card
      if (activeQuestionIndex < 2) {
        const nextIdx = activeQuestionIndex + 1;
        setActiveQuestionIndex(nextIdx);
        const nextQ = materials?.part1Questions[nextIdx];
        
        setDialogueLog([
          ...currentLog,
          {
            id: `host-part1-q${nextIdx}`,
            sender: "host",
            text: nextQ || "Tell me more about your viewpoint.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            part: 1
          }
        ]);

        // Auto start recording for the next question to provide an immersive experience
        setTimeout(() => {
          setIsRecording(true);
        }, 800);
      } else {
        // Transition to IELTS Part 2 (Cue card prepare)
        setCurrentPart(2);
        setPhase("part2");
        setPart2Preparing(true);
        setTimeRemaining(60); // 1 minute prep
        setIsTimerActive(true);
        setLiveOverlayText("Examiner: Take 1 minute to outline notes. Then speak continuously for 2 minutes.");
        setTimeout(() => setLiveOverlayText(null), 8000);

        setDialogueLog([
          ...currentLog,
          {
            id: `host-part2-intro`,
            sender: "host",
            text: `Excellent. Now we move to IELTS Speaking Part 2. I would like you to describe a topic. You have 1 minute to prepare your notes, then talk continuously for 1 to 2 minutes. Topic: ${materials?.part2CueCard.topic}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            part: 2
          }
        ]);
      }
    } else if (currentPart === 2) {
      // Move from Part 2 to Part 3 discussion questions
      setCurrentPart(3);
      setPhase("part3");
      setActiveQuestionIndex(0);
      setTimeRemaining(150); // 2.5 minutes standard for discussion
      setIsTimerActive(true);

      const firstPart3Q = materials?.part3Questions[0];
      setDialogueLog([
        ...currentLog,
        {
          id: `host-part3-intro`,
          sender: "host",
          text: `Thank you. Now we progress to IELTS Part 3 discussion questions related to our preceding topic. First question: ${firstPart3Q}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          part: 3
        }
      ]);

      // Auto-start recording for Part 3 first question
      setTimeout(() => {
        setIsRecording(true);
      }, 800);
    } else if (currentPart === 3) {
      // Move to next Part 3 question or finish interview
      if (activeQuestionIndex < 2) {
        const nextIdx = activeQuestionIndex + 1;
        setActiveQuestionIndex(nextIdx);
        const nextQ = materials?.part3Questions[nextIdx];

        setDialogueLog([
          ...currentLog,
          {
            id: `host-part3-q${nextIdx}`,
            sender: "host",
            text: nextQ || "Let's expand on this point further.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            part: 3
          }
        ]);

        // Auto-start recording for the next Part 3 question
        setTimeout(() => {
          setIsRecording(true);
        }, 800);
      } else {
        // All parts finished, trigger evaluation
        setPhase("completed");
        setIsTimerActive(false);
      }
    }
  };

  const advanceWorkflow = () => {
    if (isRecording) {
      // Must stop recording first, this will append transcript and advance once stop finishes
      setIsRecording(false);
      return;
    }
    proceedToNextQuestion(dialogueLog);
  };

  // Launch Part 2 speaking phase directly
  const startPart2Speaking = () => {
    setPart2Preparing(false);
    setTimeRemaining(120); // 2 minutes continuous dialogue speaking
    setIsTimerActive(true);
    setLiveOverlayText("Start speaking! Keep going until the 2-minute standard timer finishes.");
    setTimeout(() => setLiveOverlayText(null), 7000);
    setIsRecording(true); // Auto-start recording when starting speaking
  };

  // Trigger IELTS scoring report call to server
  const handleCalculateIELTSScore = async () => {
    setPhase("evaluating");
    
    // Rotate relaxing messages for standard user expectation
    const loadingTexts = [
      "正在收集并整理您的 Part 1/2/3 口试录音数据...",
      "正在深度分析口语断句、句法表现以及流利连贯度指标...",
      "正在精准识别高分词汇、成语搭配及语言多样性表达...",
      "核心雅思语法 GRA 诊断模型正在核验语法精确度以及时态正确性...",
      "正在为您定制输出考官专属学术寄语、纠错改写及高效提分建议..."
    ];
    let listIdx = 0;
    const loadMsgInterval = setInterval(() => {
      listIdx = (listIdx + 1) % loadingTexts.length;
      setEvaluationFeedback(loadingTexts[listIdx]);
    }, 4500);

    try {
      const response = await fetch("/api/evaluate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptLog: dialogueLog,
          durationSeconds: overallSeconds,
          chosenTopic: selectedTopic
        })
      });

      if (!response.ok) throw new Error("Evaluation engine returned error");
      const result = await response.json();
      setReport(result);
      setPhase("results");
    } catch (e: any) {
      console.error("Evaluation runtime error:", e);
      alert("IELTS evaluation failure: " + (e?.message || "Verify your backend API keys are configured correctly."));
      setPhase("idle");
    } finally {
      clearInterval(loadMsgInterval);
    }
  };

  const handleResetSession = () => {
    setPhase("idle");
    setMaterials(null);
    setDialogueLog([]);
    setOverallSeconds(0);
    setReport(null);
    setLiveTranscript("");
    setPracticeNotes("");
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]/90 text-slate-800 transition flex flex-col justify-between selection:bg-emerald-100" id="application-body">
      
      {/* Dynamic Header */}
      <header className="border-b border-[#ebd7cb]/30 bg-white/70 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center p-2 text-emerald-800">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
              雅思智能口语考官教室
              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/60 inline-flex items-center">
                ● Live AI 互动考官
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">精准对齐雅思官方口试 GRA 句型与词汇评价指标系统</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(phase === "part1" || phase === "part2" || phase === "part3") && (
            <div className="bg-slate-50 border border-slate-100 rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Clock className="h-4 w-4 text-emerald-600 animate-spin" style={{ animationDuration: "12s" }} />
              练习累计用时：<span className="text-slate-800 font-mono font-bold">{Math.floor(overallSeconds / 60)}:{(overallSeconds % 60).toString().padStart(2, "0")}</span>
            </div>
          )}

          <a 
            href="https://ielts.org/take-a-test/test-types/ielts-academic-test/speaking" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hidden md:flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase text-slate-400 hover:text-slate-600 transition"
          >
            雅思官方口试大纲指引 <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Main Container viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col justify-center">
        
        {/* State: Idle / Welcome & Setup Screen */}
        {phase === "idle" && (
          <div className="max-w-4xl mx-auto w-full space-y-8 py-4 md:py-10 fade-in">
            {/* Elegant Hero Text */}
            <div className="text-center space-y-3">
              <span className="inline-block text-[11px] font-bold tracking-wider uppercase bg-[#e9f5ee] text-emerald-800 px-3 py-1.5 rounded-full border border-[#d2eadc]">
                高保真交互式智能化双语备考教室
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight">
                像录制播客般轻松训练雅思口语 <br className="hidden sm:inline" />
                强大的 <span className="text-[#3b8c5a] italic">Gemini 智能考官</span> 全程陪同指导
              </h2>
              <p className="text-sm md:text-md text-[#615d55] max-w-2xl mx-auto leading-relaxed">
                开启您的麦克风与摄像头，任选一个考核主题，即可开始第一、二、三部分（Part 1/2/3）深度模拟测试。在您开口陈述时，Gemini 会在视频画面中即时浮现提示词、高分词汇或句型引导，带给您播客采访式的互动体验，不再畏惧卡壳。
              </p>
            </div>

            {/* Split Options Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pt-4">
              
              {/* Box 1: Topic Selector */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Compass className="h-5 w-5 text-emerald-600" />
                    1. 选择口试实练考核主题
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 font-medium">请从剑桥官方大纲中精选的高频常考话题中进行挑选：</p>
                
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.values(TopicType).map((topicVal) => (
                      <button
                        key={topicVal}
                        onClick={() => setSelectedTopic(topicVal)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                          selectedTopic === topicVal
                            ? "border-emerald-500 bg-[#eefaf2] text-emerald-800 font-bold"
                            : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600 hover:border-slate-200"
                        }`}
                      >
                        <span>{topicVal}</span>
                        {selectedTopic === topicVal && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50/70 p-4 rounded-xl border border-dashed border-slate-150 text-[11px] text-slate-400 leading-relaxed font-sans mt-auto">
                  💡 <b>高分技巧：</b> 掌握和训练多类题材的词汇表达能瞬间提升您的 <b>Lexical Resource (词汇储备)</b> 分数，向考官证明您极具内涵的语义灵活变换能力。
                </div>
              </div>

              {/* Box 2: Camera Prep & Start */}
              <div className="bg-[#fcfbf9] rounded-2xl border border-slate-100 p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Video className="h-5 w-5 text-emerald-600" />
                    2. 调整音视频录制模式
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 font-medium">在镜头前展现自然大方的肢体动作与目光接触，能大幅减缓紧绷感：</p>
                  
                  {/* Small Camera Live Checker */}
                  <div className="h-44 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-100 relative shadow-inner">
                    <CameraRecorder 
                      isRecording={false}
                      onRecordingStart={() => {}}
                      onRecordingStop={() => {}}
                      onPermissionGranted={(granted) => setIsCameraReady(granted)}
                    />
                  </div>
                </div>

                <div className="pt-4 mt-auto">
                  <button
                    onClick={handleInitiatePractice}
                    disabled={materialsLoading}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {materialsLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        考官正精心为您出题中...
                      </>
                    ) : (
                      <>
                        <Play className="h-4.5 w-4.5 fill-current" />
                        立即进入真题口试模拟
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* State: Practice IELTS Sections (Part 1, 2, 3) */}
        {(phase === "part1" || phase === "part2" || phase === "part3") && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch fade-in" id="mock-test-viewport">
            
            {/* LEFT SIDE: Professional Examiners Card & Info (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6 flex-1 flex flex-col justify-between">
                <div>
                  {/* Part Badge styling */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      雅思口语 • PART {currentPart}
                    </span>
                    <span className="text-xs text-slate-400 font-bold font-mono">
                      模拟考场实录
                    </span>
                  </div>

                  {/* Dynamic Instructions text depending on Part */}
                  {currentPart === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-slate-900">第一部分：趣味日常热身问答</h3>
                        <p className="text-xs text-slate-400 mt-1">请用自然流利的语速回答。建议每个问题作答 3-5 句，展现基本的交流能力。</p>
                      </div>

                      <div className="p-4 bg-slate-50/85 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">当前考官提问 ({activeQuestionIndex + 1}/3):</span>
                        <p className="text-sm font-serif font-semibold text-slate-800 leading-relaxed italic">
                          "{materials?.part1Questions[activeQuestionIndex]}"
                        </p>
                      </div>
                    </div>
                  )}

                  {currentPart === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-slate-900">第二部分：陈述卡片独白任务</h3>
                        <p className="text-xs text-slate-400 mt-1">根据卡片题目提示进行 1~2 分钟的连续独陈。请合理组织您的论述结构。</p>
                      </div>

                      <div className="p-5 bg-gradient-to-br from-[#fdfbf7] to-[#f5f2eb] rounded-xl border border-[#ebd7cb]/60">
                        <span className="text-[10px] font-bold text-amber-800 block mb-1">CUE CARD 描述卡片要点提示：</span>
                        <p className="text-md font-serif font-bold text-slate-800 leading-relaxed mb-3">
                          {materials?.part2CueCard.topic}
                        </p>

                        <div className="space-y-1.5 pl-3 border-l-2 border-emerald-400">
                          {materials?.part2CueCard.bullets.map((bullet, idx) => (
                            <p key={idx} className="text-xs text-slate-600 font-medium">
                              • {bullet}
                            </p>
                          ))}
                        </div>

                        <p className="text-[10px] text-slate-400 italic mt-4">
                          <b>备考友情建议:</b> {materials?.part2CueCard.advice}
                        </p>
                      </div>

                      {/* Notes Section for 1-minute brain storming */}
                      {part2Preparing && (
                        <div className="space-y-2 mt-4">
                          <label className="text-xs font-bold text-emerald-800 bg-[#eefaf2] px-2.5 py-1 rounded inline-flex items-center gap-1">
                            <Notebook className="h-3 w-3" />
                            提纲便签草稿纸（可在准备时间内在这里打字梳理思路）：
                          </label>
                          <textarea
                            value={practiceNotes}
                            onChange={(e) => setPracticeNotes(e.target.value)}
                            placeholder="可记录时态句型、观点关键词汇、或者表达连词等以辅助作答..."
                            className="w-full h-24 p-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-400 font-sans"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {currentPart === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-serif text-xl font-bold text-slate-900">第三部分：深度探讨与抽象学术延伸</h3>
                        <p className="text-xs text-slate-400 mt-1">考官会根据 Part 2 话题深度拓展。请展开讨论，提供论点、例证以及对比分析。</p>
                      </div>

                      <div className="p-4 bg-slate-50/85 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">学术探讨命题 ({activeQuestionIndex + 1}/3):</span>
                        <p className="text-sm font-serif font-semibold text-slate-800 leading-relaxed italic">
                          "{materials?.part3Questions[activeQuestionIndex]}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Left Controller bar */}
                <div className="pt-6 border-t border-slate-100 space-y-3 mt-4">
                  {/* Timer display */}
                  <div className="flex items-center justify-between text-xs font-bold bg-[#fcfbf9] p-3 rounded-lg border border-slate-150">
                    <span className="text-slate-400 flex items-center gap-1 uppercase">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {part2Preparing ? "卡片描述备考倒计时:" : "本轮建议作答时间倒计时:"}
                    </span>
                    <span className={`font-mono text-sm font-black ${timeRemaining < 15 ? "text-rose-500 animate-pulse" : "text-emerald-700"}`}>
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    {/* Primary actions: start speaking or next details */}
                    {phase === "part2" && part2Preparing ? (
                      <button
                        onClick={startPart2Speaking}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md text-xs font-bold transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Video className="h-4 w-4" /> 我已准备好，立即开口陈述
                      </button>
                    ) : (
                      <>
                        {isRecording ? (
                          <button
                            onClick={advanceWorkflow}
                            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md text-xs font-bold transition uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            我已作答完毕，保存并进入下一题
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <button
                              onClick={() => setIsRecording(true)}
                              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md text-xs font-bold transition uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Video className="h-4 w-4" /> 开始录音作答
                            </button>
                            <button
                              onClick={advanceWorkflow}
                              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              跳过此题
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT SIDE: Video Display Camera and Live Transcript Listening Overlay (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6" id="classroom-center-stage">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col flex-1 min-h-[450px]">
                
                {/* Live video stage frame container */}
                <div className="relative flex-1 flex flex-col">
                  
                  {/* Camera feed widget mount */}
                  <CameraRecorder
                    isRecording={isRecording}
                    onRecordingStart={handleRecordingStarted}
                    onRecordingStop={handleRecordingStopped}
                    onPermissionGranted={() => {}}
                  />

                  {/* Live overlay banner representing "Gemini listening and jumping in contextually" */}
                  <AnimatePresence>
                    {liveOverlayText && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="absolute bottom-24 left-4 right-4 z-20 mx-auto max-w-md bg-emerald-600/90 backdrop-blur-md text-white rounded-xl p-4 shadow-2xl border border-emerald-400 flex gap-3 select-all"
                      >
                        <Sparkles className="h-5 w-5 text-emerald-250 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200 leading-none mb-1">
                            智能考官实时辅导小贴士
                          </div>
                          <p className="text-xs font-medium leading-relaxed font-sans">{liveOverlayText}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Interactive Button overlay to request immediate assistance from AI podcast presenter */}
                  <button
                    onClick={triggerManuelHostPrompt}
                    disabled={!isRecording}
                    className="absolute bottom-20 left-4 z-20 px-3 py-1.5 bg-black/40 hover:bg-black/60 text-white rounded-lg text-[10px] font-bold tracking-wider uppercase backdrop-blur-md transition border border-white/10 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    title="获取考官提示"
                  >
                    <Sparkles className="h-3 w-3 text-emerald-300" /> 呼叫考官提供词汇/观点小贴士
                  </button>
                </div>

                {/* Subtitle feed showing what the browser Speech-to-Text registers */}
                <div className="mt-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100 min-h-[64px] flex flex-col justify-center">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                    🔴 智能语音实时采集与精准转写（您说的话）：
                  </span>
                  
                  {isRecording ? (
                    <p className="text-xs font-semibold text-slate-700 leading-relaxed select-all">
                      {liveTranscript || interimTranscript ? (
                        <>
                          <span className="text-slate-800 font-bold">{liveTranscript}</span>
                          <span className="text-emerald-500 font-medium italic">{interimTranscript}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-medium italic animate-pulse">麦克风已开启工作！请直接开口英语答题，语音引擎正在实时倾听转写中...</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium italic">
                      音视频录屏暂未启动。请在左侧点击“开始作答”或等待倒计时自动激活。
                    </p>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* State: Completed Section but awaiting user response to launch evaluation */}
        {phase === "completed" && (
          <div className="max-w-md mx-auto w-full bg-white p-8 rounded-2xl border border-slate-100 shadow-lg text-center space-y-6 fade-in">
            <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-slate-800">恭喜您！雅思模拟测试完成</h3>
              <p className="text-xs text-slate-400 mt-1">您在 Part 1, 2, 3 部分的英文口述及句式结构已成功记录并归档。</p>
            </div>

            <div className="bg-[#fcfbf9] p-4 rounded-xl border border-dashed border-slate-150 text-left space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase">口语作答完整数据检测通过表：</h4>
              <p className="text-xs text-slate-600 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" /> Part 1 日常生活热身作答语料已成功捕获
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" /> Part 2 话题卡片连续陈述表达已采集完毕
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" /> Part 3 深度互动学术思辨语料已核验封装
              </p>
            </div>

            <button
              onClick={handleCalculateIELTSScore}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition text-xs tracking-wider uppercase cursor-pointer"
            >
              一键开始生成全套雅思诊断及预估得分报告
            </button>
          </div>
        )}

        {/* State: Model Generating and evaluating */}
        {phase === "evaluating" && (
          <div className="max-w-md mx-auto w-full text-center space-y-6 py-12 fade-in">
            <div className="relative h-20 w-20 mx-auto flex items-center justify-center">
              <Loader className="h-10 w-10 text-emerald-600 animate-spin absolute" />
              <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-100" />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-serif text-2xl font-bold text-slate-800">雅思考官智能精细判分室</h3>
              <p className="text-xs text-slate-400">正在传输。学术判分大约需要 10 至 15 秒。Gemini 3.5 正在对您的语料进行逐词审议、标定语法错红线下划线并撰写学术总评。</p>
            </div>

            <div className="bg-[#eefaf2] border border-[#d2eadc] rounded-xl px-4 py-2 text-xs font-semibold text-emerald-800 inline-block animate-pulse">
              {evaluationFeedback}
            </div>
          </div>
        )}

        {/* State: Results Dashboard displaying scores and annotated errors */}
        {phase === "results" && report && (
          <IELTSEvaluationPanel 
            report={report}
            onRestart={handleResetSession}
          />
        )}

      </main>

      {/* Footer footer-tag */}
      <footer className="border-t border-slate-100 bg-white/50 px-6 py-4 text-center text-slate-405 mt-auto">
        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
          高水准雅思智能口语诊断教室 • 依托 Gemini 3.5 与 Web 语音采集系统驱动
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          本测评的打分体系、评测标准和备考小贴士深度契合英国文化协会 (British Council) 的官方考官大纲要求。高亮红线部分仅指出语病并提供学术改写建议，祝您屠鸭成功！
        </p>
      </footer>

    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Search, ShieldAlert, ShieldCheck, AlertTriangle, Loader2, Info, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

interface AnalysisResult {
  verdict: 'REAL' | 'FAKE' | 'MISLEADING' | 'UNVERIFIED';
  confidence: number;
  explanation: string;
  biasScore: number;
  biasExplanation: string;
  sources: { title: string; url: string }[];
  keyClaims: { claim: string; status: 'TRUE' | 'FALSE' | 'UNVERIFIED' }[];
}

export default function FakeNewsDetector() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeNews = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following news text or social media post for credibility, bias, and factual accuracy. 
        Provide a detailed breakdown including a verdict (REAL, FAKE, MISLEADING, UNVERIFIED), confidence score (0-100), 
        bias score (0-100 where 0 is neutral and 100 is highly biased), and a list of key claims and their status.
        
        Text to analyze: "${input}"`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING, enum: ['REAL', 'FAKE', 'MISLEADING', 'UNVERIFIED'] },
              confidence: { type: Type.NUMBER },
              explanation: { type: Type.STRING },
              biasScore: { type: Type.NUMBER },
              biasExplanation: { type: Type.STRING },
              sources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING }
                  }
                }
              },
              keyClaims: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    claim: { type: Type.STRING },
                    status: { type: Type.STRING, enum: ['TRUE', 'FALSE', 'UNVERIFIED'] }
                  }
                }
              }
            },
            required: ['verdict', 'confidence', 'explanation', 'biasScore', 'biasExplanation', 'keyClaims']
          }
        }
      });

      const data = JSON.parse(response.text || '{}') as AnalysisResult;
      
      // Extract grounding metadata if available
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const extraSources = groundingChunks
          .map(chunk => chunk.web)
          .filter(web => web && web.uri)
          .map(web => ({ title: web?.title || 'Source', url: web?.uri || '' }));
        
        data.sources = [...(data.sources || []), ...extraSources];
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Failed to analyze the news. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'REAL': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'FAKE': return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'MISLEADING': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'REAL': return <ShieldCheck className="w-8 h-8" />;
      case 'FAKE': return <ShieldAlert className="w-8 h-8" />;
      case 'MISLEADING': return <AlertTriangle className="w-8 h-8" />;
      default: return <Info className="w-8 h-8" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 mb-4">
          Verify News
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          Paste a news headline, social media post, or article snippet to analyze its credibility and factual accuracy.
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste news content here..."
          className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all resize-none text-slate-700 font-sans"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={analyzeNews}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze Credibility
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 mb-8 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Verdict Card */}
            <div className={cn("p-8 rounded-2xl border flex flex-col md:flex-row items-center gap-8", getVerdictColor(result.verdict))}>
              <div className="p-4 rounded-2xl bg-white/50">
                {getVerdictIcon(result.verdict)}
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="text-sm font-mono uppercase tracking-widest opacity-70 mb-1">Verdict</div>
                <h2 className="text-4xl font-bold mb-2">{result.verdict}</h2>
                <p className="text-lg opacity-90 leading-relaxed">
                  {result.explanation}
                </p>
              </div>
              <div className="text-center md:text-right">
                <div className="text-sm font-mono uppercase tracking-widest opacity-70 mb-1">Confidence</div>
                <div className="text-4xl font-bold">{result.confidence}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Bias Analysis */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-slate-400" />
                  Bias Analysis
                </h3>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Neutral</span>
                    <span className="text-slate-500">Highly Biased</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.biasScore}%` }}
                      className="h-full bg-slate-900"
                    />
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {result.biasExplanation}
                </p>
              </div>

              {/* Key Claims */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-slate-400" />
                  Key Claims
                </h3>
                <div className="space-y-3">
                  {result.keyClaims.map((claim, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className={cn(
                        "mt-1 w-2 h-2 rounded-full shrink-0",
                        claim.status === 'TRUE' ? 'bg-emerald-500' : 
                        claim.status === 'FALSE' ? 'bg-rose-500' : 'bg-slate-400'
                      )} />
                      <div className="flex-1">
                        <div className="text-sm text-slate-700">{claim.claim}</div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1">{claim.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sources */}
            {result.sources && result.sources.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-slate-400" />
                  Reference Sources
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.sources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-between group"
                    >
                      <span className="text-sm text-slate-600 truncate mr-2">{source.title}</span>
                      <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-900" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
        <p>© 2026 Verify News. All rights reserved.</p>
        <p className="mt-2">Always verify information from multiple reliable sources.</p>
      </footer>
    </div>
  );
}

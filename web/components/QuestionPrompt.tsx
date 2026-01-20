'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, MessageSquareMore } from 'lucide-react';
import type { QuestionEvent, Question, QuestionOption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuestionPromptProps {
  question: QuestionEvent;
  onAnswer: (questionId: string, answers: Record<number, string[]>) => void;
  onCancel: () => void;
}

interface QuestionAnswers {
  [questionIndex: number]: string[];
}

/**
 * QuestionPrompt - Renders interactive questions from AskUserQuestion tool
 *
 * Displays questions with radio buttons (single select) or checkboxes (multi select)
 * Each option shows label prominently and description in smaller text
 * Supports "Other" option with text input
 */
export default function QuestionPrompt({ question, onAnswer, onCancel }: QuestionPromptProps) {
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});
  const [showOther, setShowOther] = useState<Record<number, boolean>>({});

  // Handle option selection for a question
  const handleOptionSelect = useCallback((questionIndex: number, optionLabel: string, isMultiSelect: boolean) => {
    setAnswers(prev => {
      const currentAnswers = prev[questionIndex] || [];

      if (isMultiSelect) {
        // Toggle the option
        if (currentAnswers.includes(optionLabel)) {
          return {
            ...prev,
            [questionIndex]: currentAnswers.filter(a => a !== optionLabel)
          };
        } else {
          return {
            ...prev,
            [questionIndex]: [...currentAnswers, optionLabel]
          };
        }
      } else {
        // Single select - replace
        return {
          ...prev,
          [questionIndex]: [optionLabel]
        };
      }
    });
  }, []);

  // Handle "Other" option toggle
  const handleOtherToggle = useCallback((questionIndex: number, isMultiSelect: boolean) => {
    setShowOther(prev => ({
      ...prev,
      [questionIndex]: !prev[questionIndex]
    }));

    // If showing other, and it's single select, clear other selections
    if (!showOther[questionIndex] && !isMultiSelect) {
      setAnswers(prev => ({
        ...prev,
        [questionIndex]: []
      }));
    }
  }, [showOther]);

  // Handle other text input
  const handleOtherText = useCallback((questionIndex: number, text: string) => {
    setOtherTexts(prev => ({
      ...prev,
      [questionIndex]: text
    }));
  }, []);

  // Check if all questions have at least one answer
  const isComplete = question.questions.every((q, idx) => {
    const hasSelectedOption = (answers[idx] || []).length > 0;
    const hasOtherText = showOther[idx] && (otherTexts[idx] || '').trim().length > 0;
    return hasSelectedOption || hasOtherText;
  });

  // Submit answers
  const handleSubmit = useCallback(() => {
    const finalAnswers: Record<number, string[]> = {};

    question.questions.forEach((_, idx) => {
      const selected = answers[idx] || [];
      const other = showOther[idx] && otherTexts[idx]?.trim()
        ? [`Other: ${otherTexts[idx].trim()}`]
        : [];
      finalAnswers[idx] = [...selected, ...other];
    });

    onAnswer(question.id, finalAnswers);
  }, [question, answers, showOther, otherTexts, onAnswer]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-full max-w-2xl max-h-[85vh] bg-emblem-surface border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-4 bg-emblem-surface-2 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emblem-primary/20 rounded-lg">
                <MessageSquareMore className="w-5 h-5 text-emblem-primary" />
              </div>
              <div>
                <h2 className="m-0 text-lg text-emblem-secondary font-display font-bold">
                  Question{question.questions.length > 1 ? 's' : ''} for You
                </h2>
                <p className="text-xs text-emblem-muted mt-0.5">
                  Please answer to continue
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 bg-transparent border-none text-emblem-muted cursor-pointer rounded-lg hover:bg-emblem-surface hover:text-emblem-text transition-colors"
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Questions */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-styled">
            <div className="flex flex-col gap-6">
              {question.questions.map((q, qIdx) => (
                <QuestionCard
                  key={qIdx}
                  question={q}
                  questionIndex={qIdx}
                  totalQuestions={question.questions.length}
                  selectedOptions={answers[qIdx] || []}
                  showOther={showOther[qIdx] || false}
                  otherText={otherTexts[qIdx] || ''}
                  onOptionSelect={(label) => handleOptionSelect(qIdx, label, q.multiSelect)}
                  onOtherToggle={() => handleOtherToggle(qIdx, q.multiSelect)}
                  onOtherText={(text) => handleOtherText(qIdx, text)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 bg-emblem-surface-2 border-t border-white/10 flex justify-between items-center">
            <p className="text-xs text-emblem-muted">
              {isComplete
                ? 'Ready to submit'
                : 'Please answer all questions'}
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isComplete}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                Submit
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedOptions: string[];
  showOther: boolean;
  otherText: string;
  onOptionSelect: (label: string) => void;
  onOtherToggle: () => void;
  onOtherText: (text: string) => void;
}

function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedOptions,
  showOther,
  otherText,
  onOptionSelect,
  onOtherToggle,
  onOtherText
}: QuestionCardProps) {
  return (
    <div className="bg-emblem-surface-2 rounded-xl border border-white/5 overflow-hidden">
      {/* Question header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-emblem-primary bg-emblem-primary/15 px-2 py-1 rounded">
          {question.header.slice(0, 12)}
        </span>
        {totalQuestions > 1 && (
          <span className="text-xs text-emblem-muted">
            {questionIndex + 1} of {totalQuestions}
          </span>
        )}
        <span className="text-xs text-emblem-muted ml-auto">
          {question.multiSelect ? 'Select all that apply' : 'Select one'}
        </span>
      </div>

      {/* Question text */}
      <div className="px-4 py-3">
        <p className="text-emblem-text text-[15px] leading-relaxed m-0">
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {question.options.map((option, oIdx) => (
          <OptionButton
            key={oIdx}
            option={option}
            isSelected={selectedOptions.includes(option.label)}
            isMultiSelect={question.multiSelect}
            onClick={() => onOptionSelect(option.label)}
          />
        ))}

        {/* Other option */}
        <div
          className={cn(
            'rounded-lg border transition-all cursor-pointer',
            showOther
              ? 'border-emblem-secondary bg-emblem-secondary/10'
              : 'border-white/10 hover:border-white/20 bg-emblem-surface'
          )}
          onClick={onOtherToggle}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <div className={cn(
              'w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors',
              question.multiSelect ? 'rounded' : 'rounded-full',
              showOther
                ? 'border-emblem-secondary bg-emblem-secondary'
                : 'border-white/30'
            )}>
              {showOther && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-emblem-text font-medium text-sm m-0">
                Other
              </p>
              <p className="text-emblem-muted text-xs m-0 mt-0.5">
                Provide a custom response
              </p>
            </div>
          </div>

          {showOther && (
            <div className="px-4 pb-3" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={otherText}
                onChange={(e) => onOtherText(e.target.value)}
                placeholder="Type your answer..."
                className="w-full px-3 py-2 bg-emblem-surface border border-white/10 rounded-lg text-emblem-text text-sm outline-none focus:border-emblem-secondary transition-colors"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface OptionButtonProps {
  option: QuestionOption;
  isSelected: boolean;
  isMultiSelect: boolean;
  onClick: () => void;
}

function OptionButton({ option, isSelected, isMultiSelect, onClick }: OptionButtonProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3',
        isSelected
          ? 'border-emblem-secondary bg-emblem-secondary/10'
          : 'border-white/10 hover:border-white/20 bg-emblem-surface'
      )}
      onClick={onClick}
    >
      {/* Selection indicator */}
      <div className={cn(
        'w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors mt-0.5',
        isMultiSelect ? 'rounded' : 'rounded-full',
        isSelected
          ? 'border-emblem-secondary bg-emblem-secondary'
          : 'border-white/30'
      )}>
        {isSelected && (
          <Check className="w-3 h-3 text-white" />
        )}
      </div>

      {/* Option content */}
      <div className="flex-1 min-w-0">
        <p className="text-emblem-text font-medium text-sm m-0">
          {option.label}
        </p>
        {option.description && (
          <p className="text-emblem-muted text-xs m-0 mt-1 leading-relaxed">
            {option.description}
          </p>
        )}
      </div>
    </div>
  );
}

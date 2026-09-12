import { useState, useCallback, useRef } from 'react';
import type { ResumeAnswer, SaveState } from '../types/assessment.ts';
import { postSaveAnswer, getResume, ApiError } from '../api/assessment-client.ts';

export interface UseAnswerManagerOptions {
  attemptId: string;
  sessionId: string;
  initialAnswers: ResumeAnswer[];
  onTerminalEvent?: (code: string) => void;
}

export function useAnswerManager({
  attemptId,
  sessionId,
  initialAnswers,
  onTerminalEvent,
}: UseAnswerManagerOptions) {
  // Initialize state from resume
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [writeVersions, setWriteVersions] = useState<Record<string, number | null>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const prevInitialAnswersRef = useRef<ResumeAnswer[]>([]);

  if (prevInitialAnswersRef.current !== initialAnswers && initialAnswers.length > 0) {
    prevInitialAnswersRef.current = initialAnswers;
    const optMap: Record<string, string> = {};
    const verMap: Record<string, number | null> = {};
    const stateMap: Record<string, SaveState> = {};

    for (const ans of initialAnswers) {
      verMap[ans.snapshotId] = ans.writeVersion;
      if (
        ans.answerPayload &&
        typeof ans.answerPayload === 'object' &&
        'selectedOptionId' in ans.answerPayload &&
        typeof (ans.answerPayload as { selectedOptionId: unknown }).selectedOptionId === 'string'
      ) {
        const optId = (ans.answerPayload as { selectedOptionId: string }).selectedOptionId;
        optMap[ans.snapshotId] = optId;
        stateMap[ans.snapshotId] = {
          status: 'saved',
          writeVersion: ans.writeVersion,
          acknowledgedOptionId: optId,
        };
      } else {
        stateMap[ans.snapshotId] = { status: 'unsupported_payload' };
      }
    }

    setSelectedOptions(prev => ({ ...prev, ...optMap }));
    setWriteVersions(prev => ({ ...prev, ...verMap }));
    setSaveStates(prev => ({ ...prev, ...stateMap }));
  }

  // Use refs for latest state values in async callbacks to prevent stale closures
  const writeVersionsRef = useRef(writeVersions);
  writeVersionsRef.current = writeVersions;

  const saveStatesRef = useRef(saveStates);
  saveStatesRef.current = saveStates;

  const selectOption = useCallback(
    async (snapshotId: string, optionId: string) => {
      // If already saved with this option, do not re-save
      const currentSave = saveStatesRef.current[snapshotId];
      if (currentSave && currentSave.status === 'saved' && currentSave.acknowledgedOptionId === optionId) {
        return;
      }

      // 1. Update selection locally
      setSelectedOptions(prev => ({ ...prev, [snapshotId]: optionId }));

      // 2. Generate browser clientWriteIdentity
      const clientWriteIdentity = crypto.randomUUID();
      const expectedWriteVersion = writeVersionsRef.current[snapshotId] ?? null;

      // 3. Set saving state
      setSaveStates(prev => ({
        ...prev,
        [snapshotId]: { status: 'saving', clientWriteIdentity, pendingOptionId: optionId },
      }));

      try {
        const res = await postSaveAnswer({
          attemptId,
          sessionId,
          snapshotId,
          answerPayload: { selectedOptionId: optionId },
          clientWriteIdentity,
          expectedWriteVersion,
        });

        // Acknowledged! Update writeVersion and mark saved
        setWriteVersions(prev => ({ ...prev, [snapshotId]: res.writeVersion }));
        setSaveStates(prev => ({
          ...prev,
          [snapshotId]: {
            status: 'saved',
            writeVersion: res.writeVersion,
            acknowledgedOptionId: optionId,
          },
        }));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'stale_write_version') {
          // Bounded reconciliation: exactly one retry
          try {
            const resumeData = await getResume(attemptId);
            const remoteAnswer = resumeData.answers.find(a => a.snapshotId === snapshotId);

            if (
              remoteAnswer &&
              remoteAnswer.answerPayload &&
              typeof remoteAnswer.answerPayload === 'object' &&
              'selectedOptionId' in remoteAnswer.answerPayload &&
              (remoteAnswer.answerPayload as { selectedOptionId: unknown }).selectedOptionId === optionId
            ) {
              // Remote already matches desired option!
              setWriteVersions(prev => ({ ...prev, [snapshotId]: remoteAnswer.writeVersion }));
              setSaveStates(prev => ({
                ...prev,
                [snapshotId]: {
                  status: 'saved',
                  writeVersion: remoteAnswer.writeVersion,
                  acknowledgedOptionId: optionId,
                },
              }));
              return;
            }

            // Otherwise retry once with remote writeVersion and NEW clientWriteIdentity
            const retryVersion = remoteAnswer ? remoteAnswer.writeVersion : null;
            const retryIdentity = crypto.randomUUID();

            const retryRes = await postSaveAnswer({
              attemptId,
              sessionId,
              snapshotId,
              answerPayload: { selectedOptionId: optionId },
              clientWriteIdentity: retryIdentity,
              expectedWriteVersion: retryVersion,
            });

            setWriteVersions(prev => ({ ...prev, [snapshotId]: retryRes.writeVersion }));
            setSaveStates(prev => ({
              ...prev,
              [snapshotId]: {
                status: 'saved',
                writeVersion: retryRes.writeVersion,
                acknowledgedOptionId: optionId,
              },
            }));
            return;
          } catch {
            setSaveStates(prev => ({
              ...prev,
              [snapshotId]: {
                status: 'failed',
                error: 'Gagal menyimpan jawaban. Silakan coba lagi.',
                pendingOptionId: optionId,
              },
            }));
            return;
          }
        }

        if (err instanceof ApiError) {
          if (
            err.code === 'timer_expired' ||
            err.code === 'attempt_already_submitted' ||
            err.code === 'session_not_active'
          ) {
            onTerminalEvent?.(err.code);
          }
        }

        setSaveStates(prev => ({
          ...prev,
          [snapshotId]: {
            status: 'failed',
            error: 'Gagal menyimpan jawaban. Silakan coba lagi.',
            pendingOptionId: optionId,
          },
        }));
      }
    },
    [attemptId, sessionId, onTerminalEvent]
  );

  const hasUnresolvedSaves = Object.values(saveStates).some(
    s => s.status === 'saving' || s.status === 'failed' || s.status === 'unsupported_payload'
  );

  return {
    selectedOptions,
    saveStates,
    selectOption,
    hasUnresolvedSaves,
  };
}

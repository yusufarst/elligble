import type {
  ResumeResponse,
  QuestionsResponse,
  TimerResponse,
  SaveAnswerRequest,
  SaveAnswerResponse,
  SubmitResponse,
  ExpiryFinalizeResponse,
} from '../types/assessment.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorCode = 'unknown_error';
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') {
        errorCode = data.error;
      }
    } catch {
      // Body not JSON
    }
    throw new ApiError(res.status, errorCode);
  }
  return res.json() as Promise<T>;
}

export async function getResume(attemptId: string): Promise<ResumeResponse> {
  const url = `/api/v1/assessment/resume?attemptId=${encodeURIComponent(attemptId)}`;
  const res = await fetch(url, {
    method: 'GET',
  });
  return handleResponse<ResumeResponse>(res);
}

export async function getQuestions(attemptId: string): Promise<QuestionsResponse> {
  const url = `/api/v1/assessment/questions?attemptId=${encodeURIComponent(attemptId)}`;
  const res = await fetch(url, {
    method: 'GET',
  });
  return handleResponse<QuestionsResponse>(res);
}

export async function getTimer(attemptId: string): Promise<TimerResponse> {
  const url = `/api/v1/assessment/timer?attemptId=${encodeURIComponent(attemptId)}`;
  const res = await fetch(url, {
    method: 'GET',
  });
  return handleResponse<TimerResponse>(res);
}

export async function postSaveAnswer(req: SaveAnswerRequest): Promise<SaveAnswerResponse> {
  const url = '/api/v1/assessment/answer/save';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });
  return handleResponse<SaveAnswerResponse>(res);
}

export async function postSubmit(attemptId: string): Promise<SubmitResponse> {
  const url = '/api/v1/assessment/submit';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ attemptId }),
  });
  return handleResponse<SubmitResponse>(res);
}

export async function postExpiryFinalize(attemptId: string): Promise<ExpiryFinalizeResponse> {
  const url = '/api/v1/assessment/expiry-finalize';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ attemptId }),
  });
  return handleResponse<ExpiryFinalizeResponse>(res);
}

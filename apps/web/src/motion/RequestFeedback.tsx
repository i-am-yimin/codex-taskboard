import { Check, CircleAlert, LoaderCircle } from 'lucide-react';

type RequestState = 'pending' | 'success' | 'error' | null;
export function RequestFeedback({ state }: { state: RequestState }) {
  const Icon = state === 'pending' ? LoaderCircle : state === 'error' ? CircleAlert : Check;
  return (
    <p
      className="motion-feedback"
      data-request-state={state ?? 'idle'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {state && (
        <>
          <Icon size={16} aria-hidden="true" />
          <span>
            {state === 'pending'
              ? '正在保存，请稍候…'
              : state === 'success'
                ? '操作已完成'
                : '操作未完成，请根据错误重试。'}
          </span>
        </>
      )}
    </p>
  );
}

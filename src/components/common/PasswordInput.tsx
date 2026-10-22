'use client';
import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useT } from '@/components/i18n/LocaleProvider';

/** Password input with a show/hide (eye) button. The button sits at the inline end (left in RTL). */
export default function PasswordInput({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pe-11`} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? t('إخفاء كلمة المرور') : t('إظهار كلمة المرور')}
        aria-pressed={visible}
        className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-saudi-green-800"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

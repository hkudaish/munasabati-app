'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, Plus, Calendar, AlertCircle } from 'lucide-react';
import { useApp } from '@/lib/store';

export default function TasksTimeline() {
  const { activeOccasion, tasks, toggleTaskCompleted, addTask } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [category, setCategory] = useState('التخطيط العام');
  const [dueDaysBefore, setDueDaysBefore] = useState('10');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  if (!activeOccasion) return null;

  const occasionTasks = tasks.filter((t) => t.occasionId === activeOccasion.id);
  const completedCount = occasionTasks.filter((t) => t.isCompleted).length;
  const progressPercentage = occasionTasks.length > 0 ? Math.round((completedCount / occasionTasks.length) * 100) : 0;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const days = Number(dueDaysBefore) || 7;
    const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    addTask({
      occasionId: activeOccasion.id,
      title: taskTitle,
      category,
      dueDaysBefore: days,
      dueDate,
      isCompleted: false,
      priority,
    });

    setTaskTitle('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Progress */}
      <div className="bg-white p-5 rounded-2xl border border-saudi-sand-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-right w-full sm:w-auto">
          <h4 className="text-base font-bold text-gray-900 font-cairo flex items-center justify-center sm:justify-start gap-2">
            <Clock className="w-5 h-5 text-saudi-green-800" />
            <span>الجدول الزمني وقائمة المهام التنازلية</span>
          </h4>
          <p className="text-xs text-gray-500">
            تم إنجاز {completedCount} من أصل {occasionTasks.length} مهام ({progressPercentage}%)
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="w-32 bg-gray-100 h-2.5 rounded-full overflow-hidden hidden sm:block">
            <div
              className="bg-saudi-green-800 h-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-saudi-gold-400" />
            <span>+ إضافة مهمة</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {occasionTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => toggleTaskCompleted(task.id)}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
              task.isCompleted
                ? 'bg-saudi-sand-50 border-gray-200 opacity-75'
                : 'bg-white border-saudi-sand-300 hover:border-saudi-gold-400 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={`p-1 rounded-full transition ${
                  task.isCompleted ? 'text-green-600' : 'text-gray-400 hover:text-saudi-green-800'
                }`}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 fill-green-100" />
                ) : (
                  <Circle className="w-6 h-6" />
                )}
              </button>

              <div className="space-y-0.5">
                <span
                  className={`text-xs sm:text-sm font-bold block ${
                    task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}
                >
                  {task.title}
                </span>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="bg-saudi-sand-100 px-2 py-0.5 rounded text-gray-600 font-medium">
                    {task.category}
                  </span>
                  <span>• الموعد المستهدف: {task.dueDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  task.priority === 'high'
                    ? 'bg-red-100 text-red-700'
                    : task.priority === 'medium'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {task.priority === 'high' ? 'أولوية عاجلة' : task.priority === 'medium' ? 'أولوية متوسطة' : 'عادية'}
              </span>

              <span className="bg-saudi-green-50 text-saudi-green-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                قبل {task.dueDaysBefore} يوم
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-gray-900 font-cairo">
              إضافة مهمة جديدة للمناسبة
            </h4>

            <form onSubmit={handleAddTask} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">عنوان المهمة</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="مثال: حجز كيكة التخرج، تأكيد الحضور مع المصورة..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">القسم / التصنيف</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="الضيافة، الديكور، الدعوات..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الأولوية</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                  >
                    <option value="high">عاجلة (High)</option>
                    <option value="medium">متوسطة (Medium)</option>
                    <option value="low">عادية (Low)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الإنجاز قبل المناسبة بـ (أيام)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={dueDaysBefore}
                  onChange={(e) => setDueDaysBefore(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-saudi-gold-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white text-xs font-bold rounded-xl"
                >
                  حفظ المهمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

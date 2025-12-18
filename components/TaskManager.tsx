import React, { useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, ListTodo } from 'lucide-react';
import { Task } from '../types';

interface TaskManagerProps {
  tasks: Task[];
  onAddTask: (text: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ tasks, onAddTask, onToggleTask, onDeleteTask }) => {
  const [newTask, setNewTask] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      onAddTask(newTask.trim());
      setNewTask('');
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header / Stats */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
                <ListTodo className="w-5 h-5 text-indigo-600" />
                <span>Lab Tasks</span>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{completedCount}/{tasks.length} done</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
            />
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3">
         {tasks.length === 0 && (
             <div className="text-center text-slate-400 mt-10 p-4">
                 <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ListTodo className="w-6 h-6 text-slate-300" />
                 </div>
                 <p className="text-sm font-medium text-slate-500">No tasks yet</p>
                 <p className="text-xs mt-1">Add tasks to track your report progress.</p>
             </div>
         )}
         <ul className="space-y-2">
            {tasks.map(task => (
                <li key={task.id} className="group flex items-start gap-3 p-3 bg-white border border-slate-100 hover:border-indigo-200 rounded-xl transition-all shadow-sm hover:shadow-md">
                    <button
                        onClick={() => onToggleTask(task.id)}
                        className={`flex-shrink-0 mt-0.5 transition-colors ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-indigo-500'}`}
                    >
                        {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <span className={`flex-1 text-sm leading-relaxed ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {task.text}
                    </span>
                    <button
                        onClick={() => onDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </li>
            ))}
         </ul>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form onSubmit={handleSubmit} className="relative">
            <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a new task..."
                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
            />
            <button
                type="submit"
                disabled={!newTask.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white text-indigo-600 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
                <Plus className="w-4 h-4" />
            </button>
        </form>
      </div>
    </div>
  );
};

export default TaskManager;

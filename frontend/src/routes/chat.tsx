import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  sendMessage,
  initAgent,
  resetChat,
  getStatus,
  getScreenshot,
  type ScreenshotResponse,
} from '../api';

export const Route = createFileRoute('/chat')({
  component: ChatComponent,
});

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  steps?: number;
  success?: boolean;
}

function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<ScreenshotResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const screenshotFetchingRef = useRef(false);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 检查初始化状态
  useEffect(() => {
    getStatus()
      .then(status => setInitialized(status.initialized))
      .catch(() => setInitialized(false));
  }, []);

  // 每 3 秒刷新截图
  useEffect(() => {
    const fetchScreenshot = async () => {
      // 如果有正在进行的请求，跳过本次请求
      if (screenshotFetchingRef.current) {
        return;
      }

      screenshotFetchingRef.current = true;
      try {
        const data = await getScreenshot();
        if (data.success) {
          setScreenshot(data);
        }
      } catch (e) {
        console.error('Failed to fetch screenshot:', e);
      } finally {
        screenshotFetchingRef.current = false;
      }
    };

    // 立即获取一次
    fetchScreenshot();

    // 设置定时器每 3 秒刷新
    const interval = setInterval(fetchScreenshot, 3000);

    return () => clearInterval(interval);
  }, []);

  // 初始化 Agent
  const handleInit = async () => {
    setError(null);
    try {
      await initAgent();
      setInitialized(true);
    } catch {
      setError('初始化失败，请确保后端服务正在运行');
    }
  };

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await sendMessage(userMessage.content);

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: response.result,
        timestamp: new Date(),
        steps: response.steps,
        success: response.success,
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch {
      setError('发送失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 重置对话
  const handleReset = async () => {
    await resetChat();
    setMessages([]);
    setError(null);
  };

  // 处理按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4 gap-4">
      {/* Chatbox */}
      <div className="flex flex-col w-full max-w-2xl h-[600px] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg bg-white dark:bg-gray-800">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
          <h1 className="text-xl font-semibold">AutoGLM Chat</h1>
          <div className="flex gap-2">
            {!initialized ? (
              <button
                onClick={handleInit}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                初始化 Agent
              </button>
            ) : (
              <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm">
                已初始化
              </span>
            )}
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              重置
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <p className="text-lg">欢迎使用 AutoGLM Chat</p>
              <p className="text-sm mt-2">输入任务描述，让 AI 帮你操作手机</p>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.success === false
                      ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === 'agent' && message.steps !== undefined && (
                  <p className="text-xs mt-2 opacity-70">
                    执行步数: {message.steps}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <span className="ml-2 text-sm text-gray-500">
                    正在执行任务...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={initialized ? '输入任务描述...' : '请先初始化 Agent'}
              disabled={!initialized || loading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!initialized || loading || !input.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Screenshot Display */}
      <div className="flex flex-col w-full max-w-xs h-[600px] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">屏幕截图</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            每 3 秒自动刷新
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-gray-50 dark:bg-gray-900">
          {screenshot && screenshot.success ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={`data:image/png;base64,${screenshot.image}`}
                alt="Device Screenshot"
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                style={{
                  width: screenshot.width > screenshot.height ? '100%' : 'auto',
                  height:
                    screenshot.width > screenshot.height ? 'auto' : '100%',
                }}
              />
              {screenshot.is_sensitive && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                  敏感内容
                </div>
              )}
            </div>
          ) : screenshot?.error ? (
            <div className="text-center text-red-500 dark:text-red-400">
              <p className="mb-2">截图失败</p>
              <p className="text-xs">{screenshot.error}</p>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              <p>加载中...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

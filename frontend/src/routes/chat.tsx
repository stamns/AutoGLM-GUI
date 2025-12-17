import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  listDevices,
  getConfig,
  saveConfig,
  type Device,
  type ConfigSaveRequest,
} from '../api';
import { DeviceSidebar } from '../components/DeviceSidebar';
import { DevicePanel } from '../components/DevicePanel';

export const Route = createFileRoute('/chat')({
  component: ChatComponent,
});

function ChatComponent() {
  // 设备列表和当前选中设备
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');

  // 全局配置（所有设备共享）
  const [config, setConfig] = useState<ConfigSaveRequest | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState({
    base_url: '',
    model_name: '',
    api_key: '',
  });

  // 加载配置
  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        const data = await getConfig();
        setConfig({
          base_url: data.base_url,
          model_name: data.model_name,
          api_key: undefined,
        });
        setTempConfig({
          base_url: data.base_url,
          model_name: data.model_name,
          api_key: '',
        });

        // 如果 base_url 为空，自动打开配置模态框
        if (!data.base_url) {
          setShowConfig(true);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        setShowConfig(true); // 加载失败时也打开配置
      }
    };

    loadConfiguration();
  }, []);

  // 加载设备列表
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const response = await listDevices();
        setDevices(response.devices);

        // 自动选择第一个设备（如果当前没有选中设备）
        if (response.devices.length > 0 && !currentDeviceId) {
          setCurrentDeviceId(response.devices[0].id);
        }

        // ✅ 新增：处理当前设备被移除的情况
        if (
          currentDeviceId &&
          !response.devices.find(d => d.id === currentDeviceId)
        ) {
          setCurrentDeviceId(response.devices[0]?.id || '');
        }
      } catch (error) {
        console.error('Failed to load devices:', error);
      }
    };

    loadDevices();
    // 每3秒刷新设备列表
    const interval = setInterval(loadDevices, 3000);
    return () => clearInterval(interval);
  }, [currentDeviceId]);

  const handleSaveConfig = async () => {
    try {
      // 验证 base_url
      if (!tempConfig.base_url) {
        alert('Base URL 是必需的');
        return;
      }

      // 保存到后端
      await saveConfig({
        base_url: tempConfig.base_url,
        model_name: tempConfig.model_name || 'autoglm-phone-9b',
        api_key: tempConfig.api_key || undefined,
      });

      // 更新本地状态
      setConfig({
        base_url: tempConfig.base_url,
        model_name: tempConfig.model_name,
        api_key: tempConfig.api_key || undefined,
      });
      setShowConfig(false);

      console.log('Configuration saved successfully');
    } catch (err) {
      console.error('Failed to save config:', err);
      alert(
        `保存配置失败: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  return (
    <div className="h-full flex relative min-h-0">
      {/* Config Modal */}
      {showConfig && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-96 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                全局配置
              </h2>
              {config && config.base_url && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  ✓ 已配置
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Base URL *
                </label>
                <input
                  type="text"
                  value={tempConfig.base_url}
                  onChange={e =>
                    setTempConfig({ ...tempConfig, base_url: e.target.value })
                  }
                  placeholder="http://localhost:8080/v1"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {!tempConfig.base_url && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Base URL 是必需的
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  API Key
                </label>
                <input
                  type="password"
                  value={tempConfig.api_key}
                  onChange={e =>
                    setTempConfig({ ...tempConfig, api_key: e.target.value })
                  }
                  placeholder="留空表示不设置"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Model Name
                </label>
                <input
                  type="text"
                  value={tempConfig.model_name}
                  onChange={e =>
                    setTempConfig({ ...tempConfig, model_name: e.target.value })
                  }
                  placeholder="autoglm-phone-9b"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowConfig(false);
                    // 恢复原始配置
                    if (config) {
                      setTempConfig({
                        base_url: config.base_url,
                        model_name: config.model_name,
                        api_key: '',
                      });
                    }
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 左侧边栏 */}
      <DeviceSidebar
        devices={devices}
        currentDeviceId={currentDeviceId}
        onSelectDevice={setCurrentDeviceId}
        onOpenConfig={() => setShowConfig(true)}
      />

      {/* 右侧主内容区 - 多实例架构 */}
      <div className="flex-1 relative flex items-stretch justify-center min-h-0">
        {devices.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-lg font-medium mb-2">
                欢迎使用 AutoGLM Chat
              </h3>
              <p className="text-sm">未检测到设备，请连接 ADB 设备</p>
            </div>
          </div>
        ) : (
          devices.map(device => (
            <div
              key={device.id}
              className={`w-full h-full flex items-stretch justify-center min-h-0 ${
                device.id === currentDeviceId ? '' : 'hidden'
              }`}
            >
              <DevicePanel
                deviceId={device.id}
                deviceName={device.model}
                config={config}
                isVisible={device.id === currentDeviceId}
                isConfigured={!!config?.base_url}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

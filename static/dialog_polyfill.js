/**
 * PH Code 对话框兼容性补丁
 * 自动替换全局 alert/confirm/prompt 为 PhoiDialog
 */

(function() {
    'use strict';

    // 等待 PhoiDialog 加载
    function waitForDialog() {
        if (typeof window.PhoiDialog === 'undefined') {
            setTimeout(waitForDialog, 100);
            return;
        }

        // 保存原始函数
        const originalAlert = window.alert;
        const originalConfirm = window.confirm;
        const originalPrompt = window.prompt;

        // 替换 alert - 返回 Promise
        window.alert = async function(message, title = '提示') {
            if (window.PhoiDialog) {
                try {
                    await PhoiDialog.alert(message, title);
                } catch (err) {
                    console.error('PhoiDialog.alert 错误:', err);
                    originalAlert(message);
                }
            } else {
                originalAlert(message);
            }
        };

        // 替换 confirm - 返回 Promise
        window.confirm = async function(message, title = '确认') {
            if (window.PhoiDialog) {
                try {
                    return await PhoiDialog.confirm(message, title);
                } catch (err) {
                    console.error('PhoiDialog.confirm 错误:', err);
                    return originalConfirm(message);
                }
            } else {
                return originalConfirm(message);
            }
        };

        // 替换 prompt - 返回 Promise
        window.prompt = async function(message, defaultValue = '', title = '输入') {
            if (window.PhoiDialog) {
                try {
                    return await PhoiDialog.prompt(message, defaultValue, title);
                } catch (err) {
                    console.error('PhoiDialog.prompt 错误:', err);
                    return originalPrompt(message, defaultValue);
                }
            } else {
                return originalPrompt(message, defaultValue);
            }
        };

        console.log('[Dialog] 全局对话框替换已完成');
    }

    // 立即执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForDialog);
    } else {
        waitForDialog();
    }
})();

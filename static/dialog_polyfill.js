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

        // 替换 alert（同步版本，用于不需要等待结果的场景）
        window.safeAlert = function(message, title = '提示') {
            if (window.PhoiDialog) {
                PhoiDialog.alert(message, title).catch(err => {
                    console.error('PhoiDialog.alert 错误:', err);
                    originalAlert(message);
                });
            } else {
                originalAlert(message);
            }
        };

        // 替换 confirm（同步版本，使用回调）
        window.safeConfirm = function(message, callback, title = '确认') {
            if (window.PhoiDialog) {
                PhoiDialog.confirm(message, title).then(result => {
                    callback(result);
                }).catch(err => {
                    console.error('PhoiDialog.confirm 错误:', err);
                    callback(false);
                });
            } else {
                callback(originalConfirm(message));
            }
        };

        // 替换 prompt（同步版本，使用回调）
        window.safePrompt = function(message, defaultValue, callback, title = '输入') {
            if (window.PhoiDialog) {
                PhoiDialog.prompt(message, defaultValue, title).then(result => {
                    callback(result);
                }).catch(err => {
                    console.error('PhoiDialog.prompt 错误:', err);
                    callback(null);
                });
            } else {
                callback(originalPrompt(message, defaultValue));
            }
        };

        console.log('[Dialog] 对话框兼容补丁已加载');
    }

    // 立即执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForDialog);
    } else {
        waitForDialog();
    }
})();

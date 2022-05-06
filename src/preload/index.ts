/** @preserve
 * 如果上传或下载失败可能是网络原因请多试几次
 */

import fs from 'fs';
import path from 'path';
import * as webp from './webp';
import * as utils from './utils';
import CONFIG from './config';

window.fs = fs;
window.utils = utils;
window.webp = webp;
window.path = path;
window.tempPath = path.join(utools.getPath('temp'), CONFIG.downloadPath);

utools.onPluginEnter(async ({ code, type, payload }) => {
  fs.existsSync(window.tempPath) || fs.mkdirSync(window.tempPath);
  console.log('用户进入插件', code, type, payload);
  let files: Webp.FIleItem[] = [];
  if (type === 'files') {
    files = (payload as any[]).map(it => ({
      name: it.name,
      path: it.path,
      size: fs.statSync(it.path).size
    }));
  } else if (type === 'window') {
    const path = await utools.readCurrentFolderPath();
    console.log('path: ', path);
    if (!path) return;
    files = [{ name: '', path, size: 0 }];
  }
  files.length && window?.APP?.handleCompress?.(files);
});

<template>
  <div @dragenter="draged = true" @dragleave="draged = false" @dragover.prevent="draged = true" @drop.prevent="handleDrop" class="app">
    <ul>
      <block-item
        :error="it.error"
        :key="index"
        :name="it.name"
        :path="it.path"
        :progress="it.progress"
        :size="it.size"
        :surplus="it.surplus"
        @copy-image="handleCopys([it])"
        @replace="handleReplaces([it])"
        @retry="handleCompressOne(index)"
        v-for="(it, index) in list"
      />
    </ul>
    <div :style="{ '--width': `${info.progress}%` }" class="app__info">
      <p>进度 {{ info.success }}/{{ list.length }}</p>
      <p>失败 {{ info.error }}</p>
      <p>总计 {{ bytes(info.total) }} 压缩后 {{ bytes(info.surplus) }}</p>
      <p>
        共减少
        <span>{{ bytes(info.total - info.surplus) }}</span>
        <span>-{{ (((info.total - info.surplus) / info.total || 0) * 100).toFixed(2) }}%</span>
      </p>
      <el-button @click="handleReplaces(list)" size="mini" type="primary">覆盖原图</el-button>
      <el-button @click="handleCopyAll()" size="mini" type="primary">复制所有</el-button>
    </div>
    <transition name="fade">
      <div :draged="draged" class="app__drag" v-if="!list.length || draged">
        <i class="iconfont icon-shangchuan"></i>
        <p v-if="draged">松手压缩此图片</p>
        <p v-else>请将图片拖放到此处</p>
      </div>
    </transition>
  </div>
</template>

<style lang="scss">
.app {
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #000;

  > ul {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 15px;
    position: relative;
  }

  &__info {
    position: relative;
    height: 50px;
    display: flex;
    align-items: center;
    padding: 0 10px;

    &:before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: var(--width);
      height: 6px;
      background: #60a7ff;
      border-radius: 3px;
      transition: width 0.5s;
    }

    > p {
      padding: 0 8px;

      &:last-of-type {
        flex: 1;
        text-align: right;

        span {
          padding: 0 5px;
          color: blueviolet;

          &:last-child {
            color: green;
          }
        }
      }
    }
  }

  &__drag {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: 0.3s;
    color: #222;

    &[draged='true'] {
      background: rgba(0, 0, 0, 0.5);
      color: #000;
    }

    i {
      font-size: 100px;
      pointer-events: none;
    }

    p {
      pointer-events: none;
    }
  }
}

@media (prefers-color-scheme: dark) {
  .app {
    background: #2b2c2d;
    color: #ccc;
    &__drag {
      color: #ccc;
      background: rgba(0, 0, 0, 0);
      &[draged='true'] {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }
  }
}
</style>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import BlockItem from './block-item.vue';
import config from '../preload/config';

const { path, fs, utils, webp } = window;
const { Queue } = utils;
const { WebpCompress } = webp;

export default defineComponent({
  components: { BlockItem },
  setup() {
    const draged = ref<boolean>(false);
    const list = ref<Webp.List[]>([]);
    const imageReg = /\.(png|jpeg|jpg)$/i;
    const queue = new Queue(3);

    const info = computed(() => {
      const sum = list.value.length;
      const success = list.value.filter(it => it.progress === 1);
      const error = list.value.filter(it => it.error);
      const total = success.reduce((a, b) => a + b.size, 0);
      const surplus = success.reduce((a, b) => a + b.surplus, 0);
      return {
        progress: (success.length / sum) * 100 || 0,
        success: success.length,
        error: error.length,
        total,
        surplus,
        complete: sum === success.length + error.length
      };
    });

    async function handleCompress(files: Webp.FIleItem[]) {
      if (!info.value.complete) {
        if (
          (await ElMessageBox.confirm('还有任务未完成确认覆盖吗?', {
            confirmButtonText: '确认',
            cancelButtonText: '取消'
          }).catch(t => t)) !== 'confirm'
        )
          return;
      }

      if (!/utools.webp_local$/.test(window.tempPath)) return ElMessage.error('图片缓存路径异常！');

      // 移除上一次的缓存
      fs.readdirSync(window.tempPath)
        .map(it => path.join(window.tempPath, it))
        .filter(it => it.includes(config.downloadPath))
        .forEach(it => (fs.statSync(it).isFile() ? fs.unlinkSync(it) : fs.rmdirSync(it, { recursive: true })));

      console.log(files);

      // 销毁旧的实例
      list.value.forEach(it => it.webpCompress.destroy());
      list.value = [];

      // 递归图片文件
      let _list: Webp.FIleItem[] = [];
      for (const it of files) {
        const imagePaths = await utils.find(it.path, imageReg);
        console.log('imagePaths: ', imagePaths);
        imagePaths
          .map(item => path.normalize(item))
          .forEach(item =>
            _list.push({
              path: item,
              name: it.path === item ? path.parse(it.path).base : path.parse(it.path).name + item.replace(it.path, ''),
              size: fs.statSync(item).size
            })
          );
      }
      if (files.length && !_list.length) return ElMessage('未找到支持压缩的图片！');
      // 实例
      list.value = _list.map(it => ({
        ...it,
        progress: 0,
        error: '',
        surplus: 0,
        webpCompress: new WebpCompress({ filePath: it.path, downloadPath: path.join(window.tempPath, it.name+'.webp') })
      }));
      console.log('list: ', list.value);
      // 队列
      for (let idx = 0; idx < list.value.length; idx++) {
        await queue.push(handleCompressOne(idx));
      }
      await queue.finish();
    }

    function handleCompressOne(idx: number): Promise<any> {
      return new Promise<void>(res => {
        list.value[idx].webpCompress.removeAllListeners();
        list.value[idx].webpCompress.on('success:compress', p => {
          list.value[idx] = { ...list.value[idx], progress: 0.66, surplus: p.output.size };
          console.log('progress:compress', p);
        });
        list.value[idx].webpCompress.on('success:download', () => {
          list.value[idx] = { ...list.value[idx], progress: 1 };
          console.log('success:download');
          res();
        });

        list.value[idx].webpCompress.on('error:webp-bin-not-found', () => {
          console.log('error:webp-bin-not-found');
          handleWebpNotInstall();
        });

        list.value[idx] = { ...list.value[idx], error: '' };
        console.log('start to compress');
        list.value[idx].webpCompress.compress();
      });
    }

    function handleWebpNotInstall() {
      ElMessageBox.alert('cwebp未安装，请先安装cwebp！ mac上面使用 [brew install webp]', {}).then(() => {}).catch(() => {});
    }

    async function handleReplaces(list: Webp.List[]) {
      try {
        if (list.find(it => it.progress !== 1)) return ElMessage('请等待全部压缩完成');
        const result = await ElMessageBox.confirm('您确定要覆盖此文件吗？此操作不可还原！', {
          confirmButtonText: '确认',
          cancelButtonText: '取消'
        }).catch(t => t);

        if (result !== 'confirm') return;
        for (const { webpCompress } of list) {
          // fs.createReadStream(webpCompress.downloadPath).pipe(fs.createWriteStream(webpCompress.filePath));
          fs.renameSync(webpCompress.downloadPath, webpCompress.filePath.concat('.webp'));
          fs.unlinkSync(webpCompress.filePath);
        }
        ElMessage.success('覆盖成功！');
      } catch (error: any) {
        ElMessage.error(error);
      }
    }

    function handleCopys(list: Webp.List[]) {
      utools.copyFile(list.map(it => it.webpCompress.downloadPath)) ? ElMessage.success('复制成功！') : ElMessage.error('复制失败！');
    }

    function handleCopyAll() {
      if (!info.value.complete) return ElMessage('请等待全部压缩完成');
      utools.copyFile(fs.readdirSync(window.tempPath).map(it => path.join(window.tempPath, it)))
        ? ElMessage.success('复制成功！')
        : ElMessage.error('复制失败！');
    }

    function handleDrop(e: DragEvent) {
      draged.value = false;
      handleCompress(Array.from(e.dataTransfer?.files || []) as any as Webp.FIleItem[]);
    }
    window.APP = {
      handleCompress
    };

    return {
      ...utils,
      draged,
      list,
      queue,
      info,
      ElMessage,
      handleCopys,
      handleCopyAll,
      handleDrop,
      handleReplaces,
      handleCompressOne,
      handleCompress
    };
  }
});
</script>

import Events from 'events';
import { exec, ExecException  } from 'child_process';
import * as fs from 'fs';


function runCommand(command: string,callback: (arg0: ExecException | null, stdout: string, stderr: string) => void){

  return exec(
      command,
      (
          function(){
              return function(err,data,stderr){
                  if(!callback)
                      return;
                  callback(err, data, stderr);
              }
          }
      )()
  );
}

interface EventKeys {
  'success:compress': Webp.Response;
  'success:download': number;
  'error:webp-bin-not-found':void
}

export interface WebpCompress {
  on<K extends keyof EventKeys>(event: K, listener: (v: EventKeys[K]) => void): this;
  emit<K extends keyof EventKeys>(event: K, v: EventKeys[K]): boolean;
  emit(event: 'success:download'): boolean;
  emit(event: 'error:webp-bin-not-found'): boolean;
}

export class WebpCompress extends Events {
  public filePath!: string;
  public downloadPath!: string;

  constructor({ filePath, downloadPath }: { filePath: string; downloadPath: string }) {
    super();
    this.filePath = filePath;
    this.downloadPath = downloadPath;
  }

  public compress() {
    console.log('compress is doing ...');
    runCommand(`/usr/local/bin/cwebp -q 100 ${this.filePath} -o ${this.downloadPath} -progress`, (err, stdout, stderr) => {
      if (err){
        this.emit('error:webp-bin-not-found');
      }
      else{
        this.emit('success:compress', {
          input: {},
          output: {
            size: fs.statSync(this.downloadPath).size,
          },
        } as Webp.Response);
        this.emit('success:download')
      }
    });
  }

  public destroy() {
    this.removeAllListeners();
  }
}

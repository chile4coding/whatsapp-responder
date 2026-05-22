import * as fs from 'fs';

export class SessionManager {
  private sessionPath: string;

  constructor(sessionPath: string = './sessions') {
    this.sessionPath = sessionPath;
    this.ensureSessionDirectory();
  }

  private ensureSessionDirectory() {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  getSessionPath(): string {
    return this.sessionPath;
  }

  clearSession() {
    if (fs.existsSync(this.sessionPath)) {
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
      this.ensureSessionDirectory();
    }
  }
}
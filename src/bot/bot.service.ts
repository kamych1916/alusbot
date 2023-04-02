import { Injectable } from '@nestjs/common';
import * as axios from 'axios';
import { BotDto } from '../dtos/bot.dto';
import { validatorDto } from 'src/dtos/validator.dto';
import puppeteer from 'puppeteer';
import { io } from 'socket.io-client';

@Injectable()
export class BotService {
  private socket;
  private browser;
  private page;

  getProxyData() {
    axios.default
      .post('http://bot.midera.fun:8000/server/settings', {
        email: 'krakhimov.it@gmail.com',
      })
      .then(async (res) => {
        await validatorDto(BotDto, res.data);
        this.startBot(res.data)
          .then(() => {
            this.startSockets();
          })
          .catch((err) => {
            console.log('startBot error-> ', err);
          });
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async startBot(proxyData: BotDto) {
    this.browser = await puppeteer.launch({
      headless: false,
      timeout: 0,
      args: ['--no-sandbox', `--proxy-server=http://${proxyData.ip}`],
    });
    this.page = await this.browser.newPage();
    await this.page.authenticate({
      username: proxyData.login,
      password: proxyData.password,
    });
    await this.page.setViewport({ width: 1200, height: 720 });
    await this.page.goto('https://linkedin.com/login/', {
      waitUntil: 'networkidle0',
      timeout: 0,
    });
    await this.page.type('input[name="session_key"]', 'krakhimov.it@gmail.com');
    await this.page.type('input[name="session_password"]', 'kmwd1916');
    Promise.all([
      await this.page.click('button[type=submit]'),
      this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 0 }),
    ]);
  }

  startSockets() {
    this.socket = io('https://bot.midera.fun', {
      transports: ['websocket'],
    });
    this.socket.on('statistics', ({ link }) => {
      this.page.goto(link, {
        waitUntil: 'networkidle0',
        timeout: 0,
      });
      this.socket.emit('statistics', {
        dima: 'loh',
      });
    });
  }
}

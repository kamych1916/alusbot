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
        email: 'vacompany.info@gmail.com',
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
    // await this.page.setViewport({ width: 1200, height: 720 });
    await this.page.goto('https://linkedin.com/login/', {
      waitUntil: 'networkidle2',
      timeout: 0,
    });
    await this.page.type(
      'input[name="session_key"]',
      'vacompany.info@gmail.com',
    );
    await this.page.type('input[name="session_password"]', 'jfhy@u6EW!');
    await Promise.all([
      this.page.click('button[type=submit]'),
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 0 }),
    ]);
  }

  async startSockets() {
    this.socket = io('https://bot.midera.fun', {
      transports: ['websocket'],
    });
    await this.page.goto('https://linkedin.com/dashboard/', {
      waitUntil: 'load',
      timeout: 0,
    });
    const stats = await this.page.$$('div.pcd-analytics-view-item');
    const stats_list = [];
    stats.forEach(async (tool, id) => {
      console.log(id);
      const number = await this.page.evaluate(
        (el) => el.querySelector('div > p.text-body-large-bold').textContent,
        tool,
      );
      const text = await this.page.evaluate(
        (el) => el.querySelector('div > p.text-body-small').textContent,
        tool,
      );
      stats_list.push({
        id: id,
        stat: number.replace(/  |\r\n|\n|\r/gm, ''),
        text: text.replace(/  |\r\n|\n|\r/gm, ''),
      });
      console.log(stats_list);
    });

    console.log(stats_list);

    // this.socket.on('statistics', ({ link }) => {
    //   this.page.goto('https://linkedin.com/dashboard/', {
    //     waitUntil: 'networkidle0',
    //     timeout: 0,
    //   });
    //   this.page.waitForSelector('#ember31');
    //   const textContent = this.page.evaluate(
    //     () => document.querySelector('[data-test-foobar3="true"]').textContent,
    //   );
    //   console.log('Page title = ' + textContent);
    //   this.socket.emit('statistics', {
    //     dima: 'loh',
    //   });
    // });
  }
}

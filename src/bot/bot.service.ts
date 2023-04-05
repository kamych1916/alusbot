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
    await this.page.goto('https://linkedin.com/login/', {
      waitUntil: 'load',
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
    // https://www.linkedin.com/company/90807544/admin/

    await this.page.goto('https://www.linkedin.com/company/90807544/admin/', {
      waitUntil: 'load',
      timeout: 0,
    });
    await this.page.waitForSelector('aside.scaffold-layout__aside');
    const analytics_node = await this.page.$('aside.scaffold-layout__aside');
    const analytics_number = await analytics_node.$$eval('.t-16', (nodes) =>
      nodes.map((n) => n.innerText),
    );
    const analytics_text = await analytics_node.$$eval('.t-14', (nodes) =>
      nodes.map((n) => n.innerText),
    );
    const analytics_list = [];
    analytics_number.forEach((item, id) => {
      analytics_list.push({
        id: id,
        number: item,
        text: analytics_text[id],
      });
    });
    console.log(analytics_list);
    // for (const tool in analytics) {
    //   const number = await this.page.evaluate(
    //     (el) =>
    //       el.querySelector('section > div > div > div > p.t-16').textContent,
    //     analytics[tool],
    //   );
    //   const text = await this.page.evaluate(
    //     (el) =>
    //       el.querySelector('section > div > div > div > div > p.t-16')
    //         .textContent,
    //     analytics[tool],
    //   );
    //   analytics_list.push({
    //     id: tool,
    //     stat: number.replace(/  |\r\n|\n|\r/gm, ''),
    //     text: text.replace(/  |\r\n|\n|\r/gm, ''),
    //   });
    // }

    console.log(analytics_list);

    this.socket.on('statistics', async ({ link_organization }) => {
      // GET STATS
      await this.page.goto('https://linkedin.com/dashboard/', {
        waitUntil: 'load',
        timeout: 0,
      });
      const stats = await this.page.$$('div.pcd-analytics-view-item');
      const stats_list = [];
      for (const tool in stats) {
        const number = await this.page.evaluate(
          (el) => el.querySelector('div > p.text-body-large-bold').textContent,
          stats[tool],
        );
        const text = await this.page.evaluate(
          (el) => el.querySelector('div > p.text-body-small').textContent,
          stats[tool],
        );
        stats_list.push({
          id: tool,
          stat: number.replace(/  |\r\n|\n|\r/gm, ''),
          text: text.replace(/  |\r\n|\n|\r/gm, ''),
        });
      }

      // GET CONNECTIONS
      await this.page.goto(
        'https://www.linkedin.com/mynetwork/invite-connect/connections/',
        {
          waitUntil: 'load',
          timeout: 0,
        },
      );
      await this.page.waitForSelector('.mn-connections__header');
      await this.page.waitForSelector('h1');
      const connections = await this.page.$eval('h1', (el) => el.innerText);

      this.socket.emit('statistics', {
        data: {
          connections,
          stats_list,
        },
      });
    });
  }
}

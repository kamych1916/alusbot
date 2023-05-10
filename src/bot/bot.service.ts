import { Injectable } from '@nestjs/common';
import * as axios from 'axios';
import { BotDto } from '../dtos/bot.dto';
import { validatorDto } from 'src/dtos/validator.dto';
import puppeteer from 'puppeteer';
import { io } from 'socket.io-client';

const link_navigator =
  'https://www.linkedin.com/sales/search/people?query=(recentSearchParam%3A(id%3A2405141842%2CdoLogHistory%3Atrue)%2CspellCorrectionEnabled%3Atrue%2Cfilters%3AList((type%3AREGION%2Cvalues%3AList((id%3A104994045%2Ctext%3AMoscow%2520City%252C%2520Russia%2CselectionType%3AINCLUDED))))%2Ckeywords%3AAhmed)&sessionId=3folXQzxTW%2BBpO9YbK1Q3Q%3D%3D';

@Injectable()
export class BotService {
  private socket;
  private browser;
  private page;
  // private email = 'vacompany.info@gmail.com';
  // private password = 'jfhy@u6EW!';
  // private email = 'krakhimov.it@gmail.com';
  // private password = 'kmwd1916';
  private email = 'zakharshatrov@gmail.com';
  private password = 'gFqnxvTR2T';

  getProxyData() {
    axios.default
      .post('http://bot.midera.fun:8000/server/settings', {
        email: this.email,
      })
      .then(async (res) => {
        await validatorDto(BotDto, res.data);
        this.startBot(res.data)
          .then(async () => {
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

    await this.page.type('input[name="session_key"]', this.email);
    await this.page.type('input[name="session_password"]', this.password);
    await Promise.all([
      this.page.click('button[type=submit]'),
      this.page.waitForNavigation({ timeout: 0 }),
    ]);
  }

  async startSockets() {
    this.socket = io('https://bot.midera.fun', {
      transports: ['websocket'],
    });

    this.socket.emit('connect_email', { email: this.email });

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

      // GET ANALYTICS
      const analytics_list = [];
      if (link_organization) {
        await this.page.goto(
          'https://www.linkedin.com/company/90807544/admin/',
          {
            waitUntil: 'load',
            timeout: 0,
          },
        );
        await this.page.waitForSelector('aside.scaffold-layout__aside');
        const analytics_node = await this.page.$(
          'aside.scaffold-layout__aside',
        );
        const analytics_number = await analytics_node.$$eval('.t-16', (nodes) =>
          nodes.map((n) => n.innerText),
        );
        const analytics_text = await analytics_node.$$eval('.t-14', (nodes) =>
          nodes.map((n) => n.innerText),
        );
        for (const item in analytics_number) {
          analytics_list.push({
            id: item,
            number: analytics_number[item],
            text: analytics_text[Number(item) + 1],
          });
        }
      }

      this.socket.emit('statistics', {
        data: {
          connections,
          stats_list,
          analytics_list,
        },
        email: this.email,
      });
    });

    this.socket.on('sales_navigator', async ({ link }) => {
      await this.page.goto(link, {
        waitUntil: 'load',
        timeout: 0,
      });

      const all_users = [];
      let isBtnDisabled = false;
      while (!isBtnDisabled) {
        await this.page.waitForSelector('div._vertical-scroll-results_1igybl', {
          visible: true,
          timeout: 35000,
        });
        await this.page.waitForSelector('ol.artdeco-list', {
          visible: true,
          timeout: 35000,
        });
        await this.page.waitForSelector('div.artdeco-entity-lockup__title', {
          visible: true,
          timeout: 35000,
        });
        await this.page.waitForSelector(
          'button.artdeco-pagination__button--next',
          {
            visible: true,
            timeout: 35000,
          },
        );

        await this.page.waitForSelector('html');
        await this.page.$eval('html', (el) => {
          el.querySelector('body').style.zoom = 0.5;
        });

        await this.page.$eval('div._vertical-scroll-results_1igybl', (el) =>
          el.scrollTo({
            top: el.scrollHeight / 2.2,
            behavior: 'smooth',
          }),
        );
        await this.page.waitForTimeout(2000);
        await this.page.$eval('div._vertical-scroll-results_1igybl', (el) =>
          el.scrollTo({
            top: el.scrollHeight + 1000,
            behavior: 'smooth',
          }),
        );
        await this.page.waitForTimeout(1000);
        await this.page.$eval('div._vertical-scroll-results_1igybl', (el) =>
          el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth',
          }),
        );
        await this.page.waitForTimeout(1000);

        const users_node = await this.page.$('ol.artdeco-list');
        const user_name = await users_node.$$eval(
          'div.artdeco-entity-lockup__title > a > span',
          (nodes) => nodes.map((n) => n.innerText),
        );
        const user_company = await users_node.$$eval(
          'div.artdeco-entity-lockup__subtitle',
          (nodes) =>
            nodes.map((n) => {
              if (n.querySelector('a') !== null) {
                return n.querySelector('a').innerText;
              } else {
                if (n.querySelector('span') !== null) {
                  return n.innerText.split('  ')[1];
                } else {
                  return '';
                }
              }
            }),
        );
        const user_specialization = await users_node.$$eval(
          'div.artdeco-entity-lockup__subtitle',
          (nodes) =>
            nodes.map((n) => {
              if (n.querySelector('a') !== null) {
                return n.querySelector('span').innerText;
              } else {
                if (n.querySelector('span') !== null) {
                  return n.querySelector('span').innerText;
                } else {
                  return '';
                }
              }
            }),
        );
        const user_link = await users_node.$$eval(
          'div.artdeco-entity-lockup__title > a',
          (nodes) => nodes.map((n) => n.href),
        );
        const user_location = await users_node.$$eval(
          'div.artdeco-entity-lockup__caption > span',
          (nodes) => nodes.map((n) => n.innerText),
        );

        const users_list = [];
        for (const item in user_name) {
          users_list.push({
            id: parseInt(item) + 1,
            name: user_name[item],
            company: user_company[item],
            specialization: user_specialization[item],
            location: user_location[item],
            link: user_link[item],
          });
          all_users.push({
            id: all_users.length + 1,
            name: user_name[item],
          });
        }

        this.socket.emit('sales', users_list);
        console.log('user_sales_navigator_list_length-> ', users_list.length);
        const is_disabled =
          (await this.page.$(
            'button.artdeco-button--disabled.artdeco-pagination__button--next',
          )) !== null;
        isBtnDisabled = is_disabled;
        console.log('isBtnDisabled-> ', isBtnDisabled);

        if (!is_disabled) {
          if (
            (await this.page.$('button.artdeco-pagination__button--next')) !==
            null
          ) {
            const button = await this.page.$(
              'button.artdeco-pagination__button--next',
            );
            await button.evaluate((b) => b.click());
            // await this.page.click('button.artdeco-pagination__button--next');
            await this.page.waitForTimeout(2000);
          }
        }
      }
      console.log(all_users);
    });

    this.socket.on('sales', async ({ link }) => {
      await this.page.goto(link, {
        waitUntil: 'load',
        timeout: 0,
      });
      let isBtnDisabled = false;
      while (!isBtnDisabled) {
        await this.page.waitForSelector('main.scaffold-layout__main', {
          visible: true,
        });
        await this.page.$eval('html', (el) =>
          el.scrollTo({
            top: el.scrollHeight + 200,
            behavior: 'smooth',
          }),
        );
        await this.page.waitForSelector('span.entity-result__title-text', {
          visible: true,
        });
        await this.page.waitForSelector(
          'button.artdeco-pagination__button--next',
          {
            visible: true,
          },
        );

        const users_node = await this.page.$('div.search-results-container');
        const user_name = await users_node.$$eval(
          'span.entity-result__title-text',
          (nodes) =>
            nodes.map((n) => {
              if (n.querySelector('span') !== null) {
                return n.querySelector('span').querySelector('span').innerText;
              } else {
                return n.innerText;
              }
            }),
        );
        const user_specialization = await users_node.$$eval(
          'div.entity-result__primary-subtitle',
          (nodes) => nodes.map((n) => n.innerText),
        );
        const user_location = await users_node.$$eval(
          'div.entity-result__secondary-subtitle',
          (nodes) => nodes.map((n) => n.innerText),
        );
        const user_link = await users_node.$$eval(
          'span.entity-result__title-text > a',
          (nodes) => nodes.map((n) => n.href),
        );

        const users_list = [];
        for (const item in user_name) {
          if (user_name[item] !== 'LinkedIn Member') {
            users_list.push({
              id: parseInt(item) + 1,
              name: user_name[item],
              specialization: user_specialization[item],
              location: user_location[item],
              link: user_link[item],
            });
          }
        }

        this.socket.emit('sales', users_list);

        const is_disabled =
          (await this.page.$(
            'button.artdeco-button--disabled.artdeco-pagination__button--next',
          )) !== null;
        isBtnDisabled = is_disabled;
        if (!is_disabled) {
          await this.page.click('button.artdeco-pagination__button--next');
          await this.page.waitForTimeout(2000);
        }
      }
    });

    this.socket.on('connect_lead', async (data) => {
      const list_done = [],
        list_fail = [];

      for (const list of data) {
        await this.page.goto(list.link, { waitUntil: 'load', timeout: 0 });
        try {
          await this.page.waitForSelector('button[aria-label="More actions"]', {
            timeout: 10000,
          });
          const more = await this.page.$$('button[aria-label="More actions"]');
          await more[1].click();
          const connect = await this.page.$$(
            `button[aria-label="Invite ${list.name} to connect"]`,
          );
          if (connect.length > 0) {
            await connect[1].click();
            if (list.message !== '') {
              await this.page.waitForTimeout(2500);
              this.page.click('button[aria-label="Add a note"]');
              await this.page.waitForTimeout(500);
              await this.page.type(
                'textarea.connect-button-send-invite__custom-message',
                list.message,
              );
              await this.page.waitForTimeout(3500);
              this.page.click('button[aria-label="Send now"]');
              await this.page.waitForTimeout(3500);
            } else {
              this.page.click('button[aria-label="Send now"]');
            }
            list_done.push(list.link);
          } else {
            const connect_inner = await this.page.$$(
              `div[aria-label="Invite ${list.name} to connect"]`,
            );
            if (connect_inner.length > 0) {
              await connect_inner[1].click();
              if (list.message !== '') {
                await this.page.waitForTimeout(2500);
                this.page.click('button[aria-label="Add a note"]');
                await this.page.waitForTimeout(500);
                await this.page.type(
                  'textarea.connect-button-send-invite__custom-message',
                  list.message,
                );
                await this.page.waitForTimeout(3500);
                this.page.click('button[aria-label="Send now"]');
                await this.page.waitForTimeout(3500);
              } else {
                await this.page.click('button[aria-label="Send now"]');
              }
              list_done.push(list.link);
            } else {
              list_fail.push(list.link);
            }
          }
        } catch (error) {
          list_fail.push(list.link);
        }
      }

      this.socket.emit('connect_lead', {
        data: {
          list_done,
          list_fail,
        },
        email: this.email,
      });
    });

    this.socket.on('filter', async (data) => {
      try {
        await this.page.goto(
          'https://www.linkedin.com/mynetwork/invite-connect/connections/',
          {
            waitUntil: 'load',
            timeout: 0,
          },
        );
        await this.page.waitForSelector('header.mn-connections__header', {
          timeout: 10000,
        });
        await this.page.waitForSelector('html');

        const non_followers = new Set();
        let isEndList = false;
        while (!isEndList) {
          const users_node = await this.page.$(
            'div.scaffold-finite-scroll__content > ul',
          );
          const user_name = await users_node.$$eval(
            'span.mn-connection-card__name',
            (nodes) => nodes.map((n) => n.innerText),
          );
          if (user_name.length > 0) {
            for (const user of user_name) {
              if (user === data.name_1 || user === data.name_2) {
                isEndList = true;
                break;
              } else {
                non_followers.add(user);
              }
            }
            if (isEndList) {
              break;
            }
            await this.page.$eval('html', (el) =>
              el.scrollTo({
                top: el.scrollHeight,
                behavior: 'smooth',
              }),
            );
            await this.page.waitForTimeout(3000);
          } else {
            isEndList = true;
            break;
          }
        }
        this.socket.emit('filter', {
          data: {
            non_followers: Array.from(non_followers),
          },
          email: this.email,
        });
      } catch (error) {
        console.log('filter error -> ', error);
      }
    });
  }
}

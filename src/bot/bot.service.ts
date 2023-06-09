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
  private email = process.env.EMAIL_ACCOUNT;

  getProxyData() {
    axios.default
      .post('http://bot.midera.fun:8000/server/settings', {
        email: this.email,
      })
      .then(async (res) => {
        await validatorDto(BotDto, res.data);
        this.startBot(res.data)
          .then(async () => {
            if (res.data.twofa) {
              const isAnotherWay =
                (await this.page.$('#try-another-way')) || false;
              if (isAnotherWay) {
                await Promise.all([
                  this.page.click('#try-another-way'),
                  this.page.waitForNavigation(),
                ]);
              }
              await this.page.waitForTimeout(2000);
              await this.page.waitForSelector('input.input_verification_pin');
              await this.page.type(
                'input.input_verification_pin',
                res.data.code,
                { delay: 100 },
              );

              await Promise.all([
                this.page.click('button[type=submit]'),
                this.page.waitForNavigation(),
              ]);
              this.startSockets();
            } else {
              this.startSockets();
            }
          })
          .catch((error) => {
            console.log('startBot error-> ', error);
            axios.default.post('http://bot.midera.fun:8000/server/errors', {
              error,
              email: this.email,
            });
          });
      })
      .catch((err) => {
        console.log(err);
      });
  }

  async startBot(proxyData: BotDto) {
    console.log(this.email);
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
    await this.page.type(
      'input[name="session_password"]',
      proxyData.user_passwrod,
    );
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
      try {
        // GET STATS
        await this.page.goto('https://linkedin.com/dashboard/', {
          waitUntil: 'load',
          timeout: 0,
        });
        const stats = await this.page.$$('div.pcd-analytics-view-item');
        const stats_list = [];
        for (const tool in stats) {
          const number = await this.page.evaluate(
            (el) =>
              el.querySelector('div > p.text-body-large-bold').textContent,
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
          await this.page.goto(link_organization, {
            waitUntil: 'load',
            timeout: 0,
          });
          await this.page.waitForSelector('aside.scaffold-layout__aside');
          const analytics_node = await this.page.$(
            'aside.scaffold-layout__aside',
          );
          const analytics_number = await analytics_node.$$eval(
            '.t-16',
            (nodes) => nodes.map((n) => n.innerText),
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
      } catch (error) {
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('sales_navigator', async ({ link }) => {
      try {
        await this.page.goto(link, {
          waitUntil: 'load',
          timeout: 0,
        });

        const all_users = [];
        let isBtnDisabled = false;
        while (!isBtnDisabled) {
          await this.page.waitForSelector(
            'div._vertical-scroll-results_1igybl',
            {
              visible: true,
              timeout: 35000,
            },
          );
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
          await this.page.waitForTimeout(3000);
          await this.page.$eval('div._vertical-scroll-results_1igybl', (el) =>
            el.scrollTo({
              top: el.scrollHeight + 1000,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(3000);
          await this.page.$eval('div._vertical-scroll-results_1igybl', (el) =>
            el.scrollTo({
              top: el.scrollHeight,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(2000);

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

          this.socket.emit('sales_navigator', users_list);
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
              await this.page.waitForTimeout(4000);
            }
          }
        }
      } catch (error) {
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('sales', async ({ link }) => {
      try {
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
                  return n.querySelector('span').querySelector('span')
                    .innerText;
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
      } catch (error) {
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('connect_lead', async (data) => {
      const list_done = [],
        list_fail = [];
      let isLimit = false;
      try {
        for (const list of data) {
          if (isLimit) {
            break;
          }
          await this.page.goto(list.link, { waitUntil: 'load', timeout: 0 });
          try {
            await this.page.waitForTimeout(10000);
            await this.page.waitForSelector(
              'button[aria-label="More actions"]',
              {
                timeout: 10000,
              },
            );
            await this.page.waitForTimeout(10000);
            const more = await this.page.$$(
              'button[aria-label="More actions"]',
            );
            await more[1].click();
            const connect = await this.page.$$(
              `button[aria-label="Invite ${list.name} to connect"]`,
            );
            await this.page.waitForTimeout(5000);
            if (connect.length > 0) {
              await connect[1].click();
              if (list.message !== '') {
                await this.page.waitForTimeout(10000);
                try {
                  await Promise.all([
                    this.page.click('button[aria-label="Add a note"]'),
                  ]);
                } catch (error) {
                  list_fail.push(list.link);
                }
                await this.page.waitForTimeout(3000);
                await this.page.type(
                  'textarea.connect-button-send-invite__custom-message',
                  list.message,
                );
                await this.page.waitForTimeout(5000);
                await Promise.all([
                  this.page.click('button[aria-label="Send now"]'),
                ]);
                await this.page.waitForTimeout(5000);
              } else {
                await this.page.waitForTimeout(7000);
                await Promise.all([
                  this.page.click('button[aria-label="Send now"]'),
                ]);
              }
              await this.page.waitForTimeout(3500);
              const modalLimit = await this.page.$(
                '.artdeco-modal--layer-default',
              );
              if (modalLimit) {
                isLimit = true;
                list_fail.push(list.link);
              } else {
                list_done.push(list.link);
              }
            } else {
              const connect_inner = await this.page.$$(
                `div[aria-label="Invite ${list.name} to connect"]`,
              );
              if (connect_inner.length > 0) {
                await connect_inner[1].click();
                await this.page.waitForTimeout(3500);
                if (list.message !== '') {
                  await this.page.waitForTimeout(5000);
                  try {
                    await Promise.all([
                      this.page.click('button[aria-label="Add a note"]'),
                    ]);
                  } catch (error) {
                    list_fail.push(list.link);
                  }
                  await this.page.waitForTimeout(5000);
                  await this.page.type(
                    'textarea.connect-button-send-invite__custom-message',
                    list.message,
                  );
                  await this.page.waitForTimeout(5000);
                  this.page.click('button[aria-label="Send now"]');
                  await this.page.waitForTimeout(3500);
                } else {
                  await this.page.waitForTimeout(7000);
                  await Promise.all([
                    this.page.click('button[aria-label="Send now"]'),
                  ]);
                }
                await this.page.waitForTimeout(3500);
                const modalLimit = await this.page.$(
                  '.artdeco-modal--layer-default',
                );
                if (modalLimit) {
                  isLimit = true;
                  list_fail.push(list.link);
                } else {
                  list_done.push(list.link);
                }
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
          isLimit: isLimit,
          email: this.email,
        });
      } catch (error) {
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('friends_message', async (data) => {
      try {
        const list_done = [],
          list_fail = [];
        await this.page.goto(
          'https://www.linkedin.com/mynetwork/invite-connect/connections/',
          {
            waitUntil: 'load',
            timeout: 0,
          },
        );
        await this.page.waitForSelector('html');
        await this.page.waitForSelector('input.mn-connections__search-input');
        await this.page.waitForTimeout(2500);

        for (const item of data) {
          try {
            const listButtonsBox = await this.page.$$(
              '.msg-overlay-bubble-header__control',
            );
            const listButtonsBox_text = await this.page.$$eval(
              '.msg-overlay-bubble-header__control',
              (nodes) => {
                return nodes.map((node) => node.textContent);
              },
            );
            if (listButtonsBox.length > 0) {
              for (const box in listButtonsBox) {
                if (
                  listButtonsBox_text[box].includes(
                    'Close your conversation with',
                  )
                ) {
                  await this.page.waitForTimeout(1500);
                  listButtonsBox[box].click();
                }
              }
            }

            const searchInput = await this.page.$(
              'input.mn-connections__search-input',
            );
            await this.page.$eval(
              'input.mn-connections__search-input',
              (el) => (el.value = ''),
            );
            await this.page.waitForTimeout(2500);
            await searchInput.type(item.name);
            await this.page.waitForTimeout(4500);
            await Promise.all([
              this.page.click(
                `button[aria-label="Send a message to ${item.name}"]`,
              ),
            ]);
            await this.page.waitForTimeout(2500);
            await this.page.type(
              'div.msg-form__contenteditable',
              item.message,
              { delay: 150 },
            );
            // await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(2500);
            const isButtonSend =
              (await this.page.$('button.msg-form__send-button')) || '';
            if (isButtonSend) {
              await Promise.all([
                this.page.click('button.msg-form__send-button'),
              ]);
            } else {
              await this.page.keyboard.press('Enter');
            }
            list_done.push(item.name);
            await this.page.waitForTimeout(2500);
            const messageBox = await this.page.$$(
              '.msg-convo-wrapper button.msg-overlay-bubble-header__control',
            );
            messageBox[1].click();
            await this.page.waitForTimeout(2500);
          } catch (error) {
            console.log('что то не так -> ', error);
            list_fail.push(item.name);
          }
        }
        this.socket.emit('friends_message', {
          data: {
            list_done,
            list_fail,
          },
          email: this.email,
        });
      } catch (error) {
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
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
              if (data.name_1 === '' && data.name_2 === '') {
                isEndList = true;
                break;
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
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('check_messages_unread', async (data) => {
      try {
        await this.page.goto(
          'https://www.linkedin.com/messaging/thread/==/?filter=unread',
          {
            waitUntil: 'load',
            timeout: 0,
          },
        );
        await this.page.waitForSelector('html');
        await this.page.$eval('html', (el) => {
          el.querySelector('body').style.zoom = 0.5;
        });
        await this.page.waitForSelector('main.scaffold-layout__list-detail');

        const list_done = [];
        const list_fail = [];
        await this.page.waitForTimeout(2000);
        const unread_node = await this.page.$(
          'ul.msg-conversations-container__conversations-list',
        );
        const unread_link = await unread_node.$$(
          'li.scaffold-layout__list-item',
        );
        const unread_name = await unread_node.$$eval(
          'h3.msg-conversation-listitem__participant-names',
          (nodes) => nodes.map((n) => n.innerText),
        );
        await this.page.waitForTimeout(2000);

        for (const item in unread_name) {
          const sidebar_name = unread_name[item];
          await this.page.waitForTimeout(2000);
          await unread_link[item].$eval(
            'a.msg-conversation-listitem__link',
            (e) => e.click(),
          );
          await this.page.waitForTimeout(4500);
          const lastHeight = await this.page.$('div.msg-s-message-list');

          while (true) {
            await this.page.evaluate(
              'document.querySelector("div.msg-s-message-list").scrollTop = - document.querySelector("div.msg-s-message-list").scrollHeight',
            );
            await this.page.waitForTimeout(2000);
            const newHeight = await this.page.$('div.msg-s-message-list');
            if (newHeight.scrollHeight === lastHeight.scrollHeight) {
              break;
            }
            lastHeight.scrollHeight = newHeight.scrollHeight;
          }

          const node_list = await this.page.$('ul.msg-s-message-list-content');
          const user_message = await node_list.$$eval(
            'div.msg-s-event-listitem__message-bubble',
            (nodes) => nodes.map((n) => n.innerText),
          );
          const messages_list = await node_list.$$(
            'li.msg-s-message-list__event',
          );

          const store = [];
          if (user_message.length > 0) {
            for (const item in messages_list.reverse()) {
              let name = '';
              try {
                name = await messages_list[item].$eval(
                  'span.msg-s-message-group__name',
                  (e) => e.innerText,
                );
              } catch (error) {
                name = '';
              }

              let message = '';
              try {
                message = await messages_list[item].$eval(
                  'div.msg-s-event-listitem__message-bubble',
                  (e) => e.innerText,
                );
              } catch (error) {
                message = '';
              }

              if (message !== '') {
                store.push({
                  name: name,
                  message: message,
                });
              }
              if (name.includes(sidebar_name)) {
                break;
              }
            }
          }
          list_done.push({
            name: sidebar_name,
            messages: store,
          });
        }
        this.socket.emit('check_messages_unread', {
          data: {
            list_done,
            list_fail,
          },
          email: this.email,
        });
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('check_messages', async (data) => {
      try {
        await this.page.goto('https://www.linkedin.com/messaging', {
          waitUntil: 'load',
          timeout: 0,
        });
        await this.page.waitForSelector('html');
        await this.page.waitForSelector(
          'div.msg-conversations-container__title-row',
        );
        const clients = data;
        const list_done = [];
        const list_fail = [];
        for (const client of clients) {
          const searchInput = await this.page.$(
            'input.msg-search-form__search-field',
          );
          await this.page.$eval(
            'input.msg-search-form__search-field',
            (el) => (el.value = ''),
          );
          await this.page.waitForTimeout(2500);
          await searchInput.type(client);
          await this.page.waitForTimeout(5000);
          await this.page.keyboard.press('Enter');
          await this.page.waitForTimeout(4500);
          try {
            await this.page.click(
              '.msg-conversations-container__convo-item-link',
            );
            await this.page.waitForTimeout(4500);

            const lastHeight = await this.page.$('div.msg-s-message-list');

            while (true) {
              await this.page.evaluate(
                'document.querySelector("div.msg-s-message-list").scrollTop = - document.querySelector("div.msg-s-message-list").scrollHeight',
              );
              await this.page.waitForTimeout(2000);
              const newHeight = await this.page.$('div.msg-s-message-list');
              if (newHeight.scrollHeight === lastHeight.scrollHeight) {
                break;
              }
              lastHeight.scrollHeight = newHeight.scrollHeight;
            }

            const node_list = await this.page.$(
              'ul.msg-s-message-list-content',
            );
            const user_message = await node_list.$$eval(
              'div.msg-s-event-listitem__message-bubble',
              (nodes) => nodes.map((n) => n.innerText),
            );
            const messages_list = await node_list.$$(
              'li.msg-s-message-list__event',
            );

            const store = [];
            if (user_message.length > 0) {
              for (const item in messages_list.reverse()) {
                let name = '';
                try {
                  name = await messages_list[item].$eval(
                    'span.msg-s-message-group__name',
                    (e) => e.innerText,
                  );
                } catch (error) {
                  name = '';
                }

                let message = '';
                try {
                  message = await messages_list[item].$eval(
                    'div.msg-s-event-listitem__message-bubble',
                    (e) => e.innerText,
                  );
                } catch (error) {
                  message = '';
                }

                if (message !== '') {
                  store.push({
                    name: name,
                    message: message,
                  });
                }

                if (name.includes(client)) {
                  break;
                }
              }
            }
            list_done.push({
              name: client,
              messages: store,
            });

            await this.page.waitForTimeout(2500);

            const messages_items = await this.page.$$(
              '.msg-thread-actions__dropdown-option.artdeco-dropdown__item.artdeco-dropdown__item--is-dropdown.ember-view',
            );
            for (const ms_item in messages_items) {
              const ms_name = await messages_items[ms_item].evaluate(
                (el) => el.textContent,
              );
              if (ms_name.includes('Mark as unread')) {
                await messages_items[ms_item].evaluate((m) => m.click());
              }
            }
            await this.page.waitForTimeout(2500);
          } catch (error) {
            list_fail.push(client);
          }
        }

        this.socket.emit('check_messages', {
          data: {
            list_done,
            list_fail,
          },
          email: this.email,
        });
      } catch (error) {
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('followers', async () => {
      try {
        await this.page.goto(
          'https://www.linkedin.com/mynetwork/network-manager/people-follow/followers/',
          {
            waitUntil: 'load',
            timeout: 0,
          },
        );
        await this.page.waitForSelector('main.scaffold-layout__main', {
          timeout: 10000,
        });
        await this.page.waitForSelector('html');

        await this.page.$eval('html', (el) => {
          el.querySelector('body').style.zoom = 0.5;
        });

        const followers_list = [];

        const followers_count = await this.page.$eval(
          'p.mn-network-manager__subtitle',
          (el) => Math.trunc(Number(el.innerText.replace(/[^0-9]/g, '')) / 10),
        );

        console.log(followers_count, typeof followers_count);

        for (let item = 0; item < followers_count; item++) {
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(3000);
        }

        await this.page.waitForTimeout(2000);

        const followers_node = await this.page.$(
          'ul.reusable-search__entity-result-list',
        );

        const followers_name = await followers_node.$$eval(
          'span.entity-result__title-text',
          (nodes) => nodes.map((n) => n.innerText),
        );

        const folloers_link = await followers_node.$$eval(
          'span.entity-result__title-text > a',
          (nodes) => nodes.map((n) => n.href),
        );

        const followers_position = await followers_node.$$eval(
          'div.entity-result__primary-subtitle',
          (nodes) => nodes.map((n) => n.innerText),
        );

        console.log(followers_name.length);
        console.log(folloers_link.length);
        console.log(followers_position.length);

        // this.socket.emit('followers', { email: this.email });
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('withdraw', async () => {
      try {
        await this.page.goto(
          'https://www.linkedin.com/mynetwork/invitation-manager/sent/',
          {
            waitUntil: 'load',
            timeout: 0,
          },
        );
        await this.page.waitForSelector('html');

        await this.page.waitForTimeout(2000);

        let isBtnDisabled = false;
        while (!isBtnDisabled) {
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight / 2.2,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(2000);
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForSelector('ul.mn-invitation-list', {
            timeout: 20000,
          });
          await this.page.waitForTimeout(2000);
          const users_node = await this.page.$('ul.mn-invitation-list');
          const users_list = await users_node.$$('li.artdeco-list__item');
          const user_time = await users_node.$$eval(
            'time.time-badge',
            (nodes) => nodes.map((n) => n.innerText),
          );

          for (const item in user_time) {
            if (user_time[item].includes('month')) {
              await this.page.waitForTimeout(5000);
              await users_list[item].$eval(
                'button.invitation-card__action-btn',
                (e) => e.click(),
              );
              await this.page.waitForSelector(
                'button.artdeco-button--primary',
                {
                  timeout: 10000,
                },
              );
              await this.page.waitForTimeout(5000);
              await Promise.all([
                this.page.click('button.artdeco-button--primary'),
              ]);
            }
          }
          if ((await this.page.$('.mn-invitation-pagination')) !== null) {
            const is_disabled =
              (await this.page.$(
                'button.artdeco-button--disabled.artdeco-pagination__button--next',
              )) !== null;
            isBtnDisabled = is_disabled;

            if (!is_disabled) {
              if (
                (await this.page.$(
                  'button.artdeco-pagination__button--next',
                )) !== null
              ) {
                const button = await this.page.$(
                  'button.artdeco-pagination__button--next',
                );
                await button.evaluate((b) => b.click());
                await this.page.waitForTimeout(2000);
              }
            }
          } else {
            isBtnDisabled = false;
          }
        }
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('likes', async (response) => {
      try {
        for (const client of response) {
          await this.page.goto(client.link, {
            waitUntil: 'load',
            timeout: 0,
          });
          await this.page.waitForSelector('html');
          await this.page.$eval('html', (el) => {
            el.querySelector('body').style.zoom = 0.7;
          });
          await this.page.waitForTimeout(4000);
          if (
            (await this.page.$(
              'footer.profile-creator-shared-content-view__footer-actions',
            )) !== null
          ) {
            const have_posts = await this.page.$eval(
              'footer.profile-creator-shared-content-view__footer-actions',
              (el) => el.innerText,
            );

            if (have_posts === 'Show all posts') {
              const show_posts = await this.page.$(
                'footer.profile-creator-shared-content-view__footer-actions > a',
              );
              await show_posts.evaluate((b) => b.click());
              await this.page.waitForNavigation({ timeout: 0 });

              await this.page.waitForTimeout(5000);

              if (
                (await this.page.$('button.react-button__trigger')) !== null
              ) {
                const like_buttons = await this.page.$$(
                  'button.react-button__trigger',
                );
                for (let item = 0; item < client.count_like; item++) {
                  await like_buttons[item].evaluate((b) => b.click());
                  await this.page.waitForTimeout(4000);
                  if (client.comments.length > 0) {
                    const comment_button = await this.page.$$(
                      '.comment-button',
                    );
                    await comment_button[item].evaluate((b) => b.click());
                    await this.page.waitForTimeout(5000);

                    const comment = client.comments[item];
                    this.page.evaluate((text) => {
                      const newtext = document.createTextNode(text);
                      document
                        .querySelector('.ql-editor > p')
                        .appendChild(newtext);
                    }, comment);

                    await this.page.waitForTimeout(2000);
                    const post_button = await this.page.$(
                      'button.comments-comment-box__submit-button',
                    );
                    await post_button.evaluate((b) => b.click());
                    await this.page.waitForTimeout(2000);
                    await this.page.$eval(
                      'form.comments-comment-box__form',
                      (el) => el.remove(),
                    );
                    await this.page.waitForTimeout(4000);
                  }
                }
              }
            }
          }
        }
        const answer = response.map((el) => el.link);

        this.socket.emit('likes', {
          data: answer,
          email: this.email,
        });
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('views', async (response) => {
      try {
        const list_done = [];
        for (const client of response) {
          await this.page.goto(client, {
            waitUntil: 'load',
            timeout: 0,
          });
          await this.page.waitForSelector('html');
          await this.page.$eval('html', (el) => {
            el.querySelector('body').style.zoom = 0.7;
          });
          await this.page.waitForTimeout(4000);

          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight / 2.2,
              behavior: 'smooth',
            }),
          );

          await this.page.waitForTimeout(4000);

          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight,
              behavior: 'smooth',
            }),
          );

          await this.page.waitForTimeout(4000);

          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: 0,
              behavior: 'smooth',
            }),
          );
          list_done.push(client);
        }
        this.socket.emit('views', {
          data: list_done,
          email: this.email,
        });
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('follow', async (response) => {
      try {
        for (const client of response) {
          await this.page.goto(client.link, {
            waitUntil: 'load',
            timeout: 0,
          });
          await this.page.waitForSelector('html');
          await this.page.$eval('html', (el) => {
            el.querySelector('body').style.zoom = 0.7;
          });
          await this.page.waitForTimeout(4000);
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight / 2.2,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(4000);
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(4000);
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: 0,
              behavior: 'smooth',
            }),
          );

          const more = await this.page.$$(
            `[aria-label="Follow ${client.name}"]`,
          );
          await more[0].evaluate((b) => b.click());

          await this.page.waitForTimeout(4000);
        }
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('profile_info', async (response) => {
      try {
        // const response = ['https://www.linkedin.com/in/salman-y-3135a021/'];
        const contact_info = [];
        const education = [];
        const experience = [];

        for (const client of response) {
          await this.page.goto(client, {
            waitUntil: 'load',
            timeout: 0,
          });
          await this.page.waitForTimeout(4000);
          await this.page.waitForSelector('html');
          await this.page.$eval('html', (el) => {
            el.querySelector('body').style.zoom = 0.7;
          });
          await this.page.waitForTimeout(4000);
          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight / 2.2,
              behavior: 'smooth',
            }),
          );

          const client_name_block = await this.page.$(
            '.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
          );
          const client_name = await this.page.evaluate(
            (el) => el.textContent.trim(),
            client_name_block,
          );
          await this.page.waitForTimeout(2000);
          if (
            (await this.page.$(
              '.ember-view.link-without-visited-state.cursor-pointer.text-heading-small.inline-block.break-words',
            )) !== null
          ) {
            const contact_info_button = await this.page.$(
              '.ember-view.link-without-visited-state.cursor-pointer.text-heading-small.inline-block.break-words',
            );
            await contact_info_button.evaluate((el) => el.click());
            await this.page.waitForTimeout(2000);

            const info_thread = await this.page.$$(
              '.pv-profile-section__section-info.section-info > section',
            );
            for (const item in info_thread) {
              const title = await this.page.evaluate(
                (el) =>
                  el
                    .querySelector('.pv-contact-info__header')
                    .textContent.trim(),
                info_thread[item],
              );
              try {
                const text = await this.page.evaluate(
                  (el) =>
                    el
                      .querySelector('.pv-contact-info__ci-container')
                      .textContent.trim(),
                  info_thread[item],
                );
                contact_info.push({
                  client_name,
                  title,
                  text,
                });
              } catch {
                continue;
              }
            }
            const close_modal_button = await this.page.$(
              '.artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view',
            );
            await close_modal_button.evaluate((el) => el.click());
          }

          await this.page.$eval('html', (el) =>
            el.scrollTo({
              top: el.scrollHeight,
              behavior: 'smooth',
            }),
          );
          await this.page.waitForTimeout(4000);

          const education_thread = await this.page.$$(
            '.artdeco-card.ember-view.relative.break-words.pb3.mt2',
          );

          for (const item in education_thread) {
            const head = await this.page.evaluate((el) => {
              const title = el.querySelector(
                'h2.pvs-header__title.text-heading-large',
              );
              if (title) {
                return title.textContent.trim();
              } else {
                return '';
              }
            }, education_thread[item]);
            if (head.includes('Education')) {
              const text = await education_thread[item].evaluate((el) => {
                return [...el.querySelectorAll('span.visually-hidden')].map(
                  (el) => el.textContent.trim(),
                );
              }, education_thread[item]);
              education.push({
                client_name,
                text,
              });
              break;
            }
          }

          const experience_thread = await this.page.$$(
            '.artdeco-card.ember-view.relative.break-words.pb3.mt2',
          );
          for (const item in experience_thread) {
            const head = await this.page.evaluate((el) => {
              const title = el.querySelector(
                'h2.pvs-header__title.text-heading-large',
              );
              if (title) {
                return title.textContent.trim();
              } else {
                return '';
              }
            }, education_thread[item]);
            if (head.includes('Experience')) {
              const experience_link_node = await this.page.$(
                'a.optional-action-target-wrapper.display-flex',
              );
              if (experience_link_node !== null) {
                const experience_link_text = await this.page.$eval(
                  'a.optional-action-target-wrapper.display-flex',
                  (el) => el.href,
                );
                if (experience_link_text.includes('company')) {
                  const experience_link_button = await this.page.$(
                    'a.optional-action-target-wrapper.display-flex',
                  );
                  await experience_link_button.evaluate((el) => el.click());
                  await this.page.waitForNavigation({ timeout: 60000 });
                  await this.page.waitForTimeout(4000);
                  const company_link = await this.page.url();
                  if (
                    (await this.page.$(
                      'h1.ember-view.text-display-medium-bold.org-top-card-summary__title.full-width',
                    )) !== null
                  ) {
                    const company_name = await this.page.$eval(
                      'h1.ember-view.text-display-medium-bold.org-top-card-summary__title.full-width',
                      (el) => el.innerText,
                    );

                    let company_description = '';
                    if (
                      (await this.page.$(
                        'p.org-top-card-summary__tagline.org-top-card-improvement-summary__tagline',
                      )) !== null
                    ) {
                      company_description = await this.page.$eval(
                        'p.org-top-card-summary__tagline.org-top-card-improvement-summary__tagline',
                        (el) => el.innerText,
                      );
                    }

                    let comapny_tags = '';
                    if (
                      (await this.page.$(
                        '.org-top-card-summary-info-list.org-top-card-improvement-summary-info-list',
                      )) !== null
                    ) {
                      comapny_tags = await this.page.$eval(
                        '.org-top-card-summary-info-list.org-top-card-improvement-summary-info-list',
                        (el) => el.innerText,
                      );
                    }

                    experience.push({
                      client_name,
                      company_link,
                      company_name,
                      company_description,
                      comapny_tags,
                    });
                  }
                }
              }
              break;
            }
          }
        }
        // console.log({
        //   contact_info,
        //   experience,
        //   education,
        // });
        this.socket.emit('profile_info', {
          data: {
            contact_info,
            education,
            experience,
          },
          email: this.email,
        });
      } catch (error) {
        console.log(error);
        axios.default.post('http://bot.midera.fun:8000/server/errors', {
          error,
          email: this.email,
        });
      }
    });

    this.socket.on('info', async () => {
      this.socket.emit('connect_email', { email: this.email });
    });
  }
}

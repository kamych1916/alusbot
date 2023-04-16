import { Injectable } from '@nestjs/common';
import * as axios from 'axios';
import { BotDto } from '../dtos/bot.dto';
import { validatorDto } from 'src/dtos/validator.dto';
import puppeteer from 'puppeteer';
import { io } from 'socket.io-client';

const link_filters =
  'https://www.linkedin.com/sales/search/people?query=(recentSearchParam%3A(id%3A2101744345%2CdoLogHistory%3Atrue)%2Cfilters%3AList((type%3ACURRENT_TITLE%2Cvalues%3AList((id%3A1%2Ctext%3AOwner%2CselectionType%3AINCLUDED)%2C(id%3A103%2Ctext%3ACo-Founder%2CselectionType%3AINCLUDED)%2C(id%3A35%2Ctext%3AFounder%2CselectionType%3AINCLUDED)%2C(id%3A195%2Ctext%3ACo-Owner%2CselectionType%3AINCLUDED)%2C(id%3A153%2Ctext%3AChief%2520Technology%2520Officer%2CselectionType%3AINCLUDED)%2C(text%3ACTO%2CselectionType%3AINCLUDED)%2C(text%3ACPO%2CselectionType%3AINCLUDED)%2C(id%3A11821%2Ctext%3AChief%2520Product%2520Officer%2CselectionType%3AINCLUDED)%2C(id%3A203%2Ctext%3AChief%2520Information%2520Officer%2CselectionType%3AINCLUDED)%2C(text%3ACIO%2CselectionType%3AINCLUDED)%2C(text%3ACEO%2CselectionType%3AINCLUDED)%2C(id%3A8%2Ctext%3AChief%2520Executive%2520Officer%2CselectionType%3AINCLUDED)%2C(id%3A5%2Ctext%3ADirector%2CselectionType%3AINCLUDED)%2C(text%3A%25D0%25A4%25D0%25B0%25D1%2583%25D0%25BD%25D0%25B4%25D0%25B5%25D1%2580%2CselectionType%3AINCLUDED)%2C(text%3A%25D0%25A1%25D0%2595%25D0%259E%2CselectionType%3AINCLUDED)%2C(text%3A%25D0%259E%25D1%2581%25D0%25BD%25D0%25BE%25D0%25B2%25D0%25B0%25D1%2582%25D0%25B5%25D0%25BB%25D1%258C%2CselectionType%3AINCLUDED)%2C(text%3A%25D0%2594%25D0%25B8%25D1%2580%25D0%25B5%25D0%25BA%25D1%2582%25D0%25BE%25D1%2580%2CselectionType%3AINCLUDED)%2C(text%3A%25D0%2598%25D0%25A2%2520%25D0%25B4%25D0%25B8%25D1%2580%25D0%25B5%25D0%25BA%25D1%2582%25D0%25BE%25D1%2580%2CselectionType%3AINCLUDED)%2C(id%3A163%2Ctext%3ADirector%2520of%2520Information%2520Technology%2CselectionType%3AINCLUDED)%2C(id%3A688%2Ctext%3AHead%2520of%2520Information%2520Technology%2CselectionType%3AINCLUDED)%2C(text%3AHR%2CselectionType%3AEXCLUDED)%2C(text%3AHuman%2520Resources%2CselectionType%3AEXCLUDED)%2C(text%3ATalent%2CselectionType%3AEXCLUDED)))%2C(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AC%2Ctext%3A11-50%2CselectionType%3AINCLUDED)%2C(id%3AB%2Ctext%3A1-10%2CselectionType%3AINCLUDED)%2C(id%3AD%2Ctext%3A51-200%2CselectionType%3AINCLUDED)))%2C(type%3APROFILE_LANGUAGE%2Cvalues%3AList((id%3Aru%2Ctext%3ARussian%2CselectionType%3AINCLUDED)))%2C(type%3AREGION%2Cvalues%3AList((id%3A102105699%2Ctext%3ATurkey%2CselectionType%3AINCLUDED)%2C(id%3A106049128%2Ctext%3AKazakhstan%2CselectionType%3AINCLUDED)%2C(id%3A103030111%2Ctext%3AArmenia%2CselectionType%3AINCLUDED)))%2C(type%3AINDUSTRY%2Cvalues%3AList((id%3A80%2Ctext%3AAdvertising%2520Services%2CselectionType%3AINCLUDED)%2C(id%3A43%2Ctext%3AFinancial%2520Services%2CselectionType%3AINCLUDED)%2C(id%3A6%2Ctext%3ATechnology%252C%2520Information%2520and%2520Internet%2CselectionType%3AINCLUDED)%2C(id%3A1594%2Ctext%3ATechnology%252C%2520Information%2520and%2520Media%2CselectionType%3AINCLUDED)%2C(id%3A1445%2Ctext%3AOnline%2520and%2520Mail%2520Order%2520Retail%2CselectionType%3AINCLUDED)%2C(id%3A113%2Ctext%3AOnline%2520Audio%2520and%2520Video%2520Media%2CselectionType%3AINCLUDED)%2C(id%3A27%2Ctext%3ARetail%2CselectionType%3AINCLUDED)%2C(id%3A44%2Ctext%3AReal%2520Estate%2CselectionType%3AINCLUDED)%2C(id%3A24%2Ctext%3AComputers%2520and%2520Electronics%2520Manufacturing%2CselectionType%3AINCLUDED)%2C(id%3A3100%2Ctext%3AMobile%2520Computing%2520Software%2520Products%2CselectionType%3AINCLUDED)%2C(id%3A32%2Ctext%3ARestaurants%2CselectionType%3AINCLUDED)%2C(id%3A35%2Ctext%3AMovies%252C%2520Videos%252C%2520and%2520Sound%2CselectionType%3AINCLUDED)%2C(id%3A3124%2Ctext%3AInternet%2520News%2CselectionType%3AINCLUDED)%2C(id%3A84%2Ctext%3AInformation%2520Services%2CselectionType%3AINCLUDED)))))&sessionId=n2k9rXxgQMyM3J05bZ68jg%3D%3D&viewAllFilters=true';

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
          .then(async () => {
            // this.startSockets();

            await this.page.goto(link_filters, {
              waitUntil: 'load',
              timeout: 0,
            });

            const users_list = [];
            let isBtnDisabled = false;
            while (!isBtnDisabled) {
              await this.page.waitForSelector(
                'div._vertical-scroll-results_1igybl',
                { visible: true },
              );
              await this.page.waitForSelector('ol.artdeco-list', {
                visible: true,
              });
              await this.page.waitForSelector(
                'div.artdeco-entity-lockup__title',
                { visible: true },
              );
              await this.page.waitForSelector(
                'div.artdeco-entity-lockup__subtitle',
                { visible: true },
              );
              await this.page.waitForSelector(
                'div.artdeco-entity-lockup__caption',
                { visible: true },
              );
              await this.page.waitForSelector(
                '.artdeco-pagination__button--next',
                { visible: true },
              );

              await this.page.$eval(
                'div._vertical-scroll-results_1igybl',
                (el) =>
                  el.scrollTo({
                    top: el.scrollHeight / 1.5,
                    behavior: 'smooth',
                  }),
              );
              await this.page.waitForTimeout(2000);
              await this.page.$eval(
                'div._vertical-scroll-results_1igybl',
                (el) =>
                  el.scrollTo({
                    top: el.scrollHeight + 200,
                    behavior: 'smooth',
                  }),
              );
              await this.page.waitForTimeout(2000);

              const users_node = await this.page.$('ol.artdeco-list');
              const user_name = await users_node.$$eval(
                'div.artdeco-entity-lockup__title > a > span',
                (nodes) => nodes.map((n) => n.innerText),
              );
              const user_specialization = await users_node.$$eval(
                'div.artdeco-entity-lockup__subtitle',
                (nodes) => nodes.map((n) => n.innerText),
              );
              const user_link = await users_node.$$eval(
                'div.artdeco-entity-lockup__title > a',
                (nodes) => nodes.map((n) => n.href),
              );
              const user_location = await users_node.$$eval(
                'div.artdeco-entity-lockup__caption > span',
                (nodes) => nodes.map((n) => n.innerText),
              );

              for (const item in user_name) {
                users_list.push({
                  id: parseInt(item) + 1,
                  name: user_name[item],
                  specialization: user_specialization[item],
                  location: user_location[item],
                  link: user_link[item],
                });
              }

              const is_disabled =
                (await this.page.$(
                  'button.artdeco-button--disabled.artdeco-pagination__button--next',
                )) !== null;
              isBtnDisabled = is_disabled;

              if (!is_disabled) {
                await this.page.click(
                  'button.artdeco-pagination__button--next',
                );
                console.log('user_list-> ', users_list);
                console.log('user_list_length-> ', users_list.length);
              }
            }
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
      console.log(connections, stats_list, analytics_list);

      this.socket.emit('statistics', {
        data: {
          connections,
          stats_list,
          analytics_list,
        },
      });
    });

    this.socket.on('sales', async ({ link }) => {
      console.log(link);
      await this.page.goto(link, {
        waitUntil: 'load',
        timeout: 0,
      });
    });
  }
}

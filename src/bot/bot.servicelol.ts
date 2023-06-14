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
    this.startBot();
  }

  async startBot() {
    this.browser = await puppeteer.launch({
      headless: false,
      timeout: 0,
    });
    this.page = await this.browser.newPage();
    await this.page.goto('https://web.telegram.org/k/', {
      waitUntil: 'load',
      timeout: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const readline = require('readline-sync');
    let name = readline.question('Enter 1 to continue');
    await this.page.$eval('html', (el) => {
      el.querySelector('body').style.zoom = 0.5;
    });

    if ((name = 1)) {
      const users_list = [
        'https://web.telegram.org/k/#@veronicalus',
        'https://web.telegram.org/k/#@FaustGet',
      ];
      for (const user of users_list) {
        this.page = await this.browser.newPage();
        await this.page.goto(user, {
          waitUntil: 'load',
          timeout: 0,
        });
        await this.page.waitForTimeout(5000);

        const exsist =
          (await this.page.$('avatar-element.person-avatar')) !== null;
        if (exsist) {
          await this.page.type(
            'div.input-message-input',
            `Hi!\nThis is a test message from bot automation in tg, I hope everything worked out!`,
            { delay: 70 },
          );
          await this.page.waitForTimeout(3000);
          await this.page.keyboard.press('Enter');
          await this.page.waitForTimeout(5000);
        }
        await this.page.close();
      }
    }
  }
}

// const main_node = await this.page.$('div.search-super-content-chats');
// const groups = await main_node.$$('div.search-group');
// for (const groups_item of groups) {
//   const group_name = await groups_item.evaluate((el) => {
//     const element = el.querySelector('div.search-group__name > span');
//     if (element) {
//       return element.textContent;
//     }
//     return '';
//   });
//   if (group_name === 'Chats' || group_name === 'Global search') {
//     const chatList = await groups_item.$('ul.chatlist');
//     const chat = await chatList.$$('a.chatlist-chat-abitbigger');
//     for (const chat_item in chat) {
//       const chat_name = await chat[chat_item].evaluate((el) => {
//         const element = el.querySelector(
//           'div.dialog-subtitle > div.row-subtitle',
//         );
//         if (element) {
//           return element.textContent;
//         }
//         return '';
//       });
//       console.log(chat_name, user_list[user]);
//       if (chat_name === user_list[user]) {
//         console.log('kek');
//         await chat[chat_item].click();
//         await this.page.evaluate(() => {
//           const clickEvent = document.createEvent('MouseEvents');
//           clickEvent.initMouseEvent(
//             'mousedown',
//             true,
//             false,
//             window,
//             0,
//             0,
//             0,
//             0,
//             0,
//             false,
//             false,
//             false,
//             false,
//             0,
//             null,
//           );
//           chat[chat_item].dispatchEvent(clickEvent);
//         });
//         console.log('lol');
//       }
//     }
//   }
// }

// search-group__name
// const unread_name = await this.page.$$eval(
//   '.chatlist-chat-abitbigger',
//   (nodes) => nodes.map((n) => n.innerText),
// );

// search-group
// console.log(unread_name);

// await this.page.click(
//   '.chatlist-chat-abitbigger',
// );
// await this.page.waitForTimeout(4500);

// await this.page.type(
//   'div.input-message-input',
//   "Привет!\nЭто тестовое сообщения от автоматизации бота в tg, надеюсь все получилось!",
//   { delay: 70 },
// );

// await this.page.waitForTimeout(3000);
// await this.page.keyboard.press('Enter');

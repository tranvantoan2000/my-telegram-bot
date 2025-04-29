require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

readFile();

class ConflictException extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictException";
  }
}

class BadCommandException extends Error {
  constructor(message) {
    super(message);
    this.name = "BadCommandException";
  }
}

const syntax = `/add <name> <phone number> : Add new phone number to contacts \n
/list: View contacts \n
/delete <id>: Delete phone number\n
/update <id> <new name> <new number phone>: Change phone number in contacts`;

const msgErrBadCommandE = "Bạn nhập sai cú pháp";

let pendingMap = new Map();

let pendingObj = {};

let contacts = [];

function handleRequest(msg) {
  const chatID = msg.chat.id;

  const commandArgs = msg.text.split(" ");

  const actionRequest = commandArgs[0];
  switch (actionRequest) {
    case "/add": {
      if (commandArgs.length != 3)
        throw new BadCommandException(msgErrBadCommandE);

      const phoneNumber = commandArgs[2];
      if (!checkPhoneNumber(phoneNumber))
        throw new BadCommandException("Số điện thoại không đúng định dạng!");

      const found = contacts.find(
        (el) => chatID == el.idUser && phoneNumber == el.phoneNumber
      );
      if (found) throw new ConflictException("Số điện thoại đã tồn tại!");

      const name = commandArgs[1];
      const timeStart = new Date();
      pendingObj = {
        action: actionRequest,
        payload: { name, phoneNumber, timeStart },
      };
      pendingMap.set(chatID, pendingObj);

      bot.sendMessage(
        chatID,
        `Bạn xác nhận thêm\nTên: ${name}, Số điện thoại: ${phoneNumber}\nĐồng ý nhập "Y", không đồng ý nhập "N"`
      );
      break;
    }

    case "/list": {
      const firstIndexChatID = contacts.indexOf(
        contacts.find((el) => el.idUser == chatID)
      );
      if (firstIndexChatID == -1)
        throw new BadCommandException("Danh bạ trống!");

      if (commandArgs.length != 1)
        throw new BadCommandException(msgErrBadCommandE);

      bot.sendMessage(chatID, list(chatID));
      break;
    }

    case "/delete": {
      if (commandArgs.length != 2)
        throw new BadCommandException(msgErrBadCommandE);

      const idPhoneBook = commandArgs[1];
      const timeStart = new Date();
      pendingObj = {
        action: actionRequest,
        payload: { idPhoneBook, timeStart },
      };
      pendingMap.set(chatID, pendingObj);

      bot.sendMessage(
        chatID,
        `Bạn xác nhận xóa số điện thoại ID:${idPhoneBook}\nĐồng ý nhập "Y", không đồng ý nhập "N"`
      );
      break;
    }

    case "/update": {
      if (commandArgs.length != 4)
        throw new BadCommandException(msgErrBadCommandE);

      const idPhoneBook = commandArgs[1];
      const newName = commandArgs[2];
      const newPhoneNumber = commandArgs[3];
      const timeStart = new Date();
      pendingObj = {
        action: actionRequest,
        payload: { idPhoneBook, newName, newPhoneNumber, timeStart },
      };
      pendingMap.set(chatID, pendingObj);

      bot.sendMessage(
        chatID,
        `Bạn xác nhận thay đổi số điện thoại id: ${idPhoneBook} thành:\nTên mới: ${newName}, Số điện thoại mới: ${newPhoneNumber}\nĐồng ý nhập "Y", không đồng ý nhập "N"`
      );
      break;
    }
    default:
      bot.sendMessage(chatID, syntax);
  }
}

function handleConfirmYesNo(msg) {
  const chatID = msg.chat.id;

  if (!pendingMap.has(chatID)) {
    bot.sendMessage(chatID, `Không có hành động nào cần xác nhận`);
    return;
  }

  const actionText = msg.text;

  if (actionText == "N") {
    pendingMap.delete(chatID);
    bot.sendMessage(chatID, "Hủy thao tác thành công");
    return;
  }

  if (actionText == "Y") {
    const action = pendingMap.get(chatID).action;
    switch (action) {
      case "/add": {
        add(chatID);
        bot.sendMessage(
          chatID,
          "Thêm số mới thành công, nhập /list để kiểm tra danh bạ"
        );
        writeFile();
        pendingMap.delete(chatID);
        break;
      }
      case "/delete": {
        del(chatID);
        bot.sendMessage(
          chatID,
          "Xóa thành công, nhập /list để kiểm tra danh bạ"
        );
        writeFile();
        pendingMap.delete(chatID);
        break;
      }
      case "/update": {
        update(chatID);
        bot.sendMessage(
          chatID,
          "Sửa thành công, nhập /list để kiểm tra danh bạ"
        );
        writeFile();
        pendingMap.delete(chatID);
        break;
      }
    }
    return;
  }
}

let nextId = 0;
function add(chatID) {
  nextId += 1;
  const idPhoneBook = nextId;
  const name = pendingMap.get(chatID).payload.name;
  const phoneNumber = pendingMap.get(chatID).payload.phoneNumber;
  const idUser = chatID;

  const phoneBook = {
    idPhoneBook,
    name,
    phoneNumber,
    idUser,
  };
  contacts.push(phoneBook);
}

function list(chatID) {
  return contacts
    .filter((el) => chatID == el.idUser)
    .map(
      (el) =>
        `Id: ${el.idPhoneBook}, Tên: ${el.name}, Số điện thoại: ${el.phoneNumber}`
    )
    .join("\n");
}

function del(chatID) {
  const idDelete = pendingMap.get(chatID).payload.idPhoneBook;
  contacts = contacts.filter(
    (el) => !(el.idPhoneBook == idDelete && el.idUser == chatID)
  );
}

function update(chatID) {
  const idPhoneBookUpdate = pendingMap.get(chatID).payload.idPhoneBook;
  const newName = pendingMap.get(chatID).payload.newName;
  const newPhoneNumber = pendingMap.get(chatID).payload.newPhoneNumber;

  contacts.map((el) => {
    if (el.idPhoneBook == idPhoneBookUpdate) {
      el.name = newName;
      el.phoneNumber = newPhoneNumber;
    }
    return el;
  });
}

function checkPhoneNumber(phoneNumber) {
  const reg = /^(0|\+84)(\d{9})$/;
  return reg.test(phoneNumber);
}

function writeFile() {
  const myJSON = JSON.stringify(contacts);
  const fs = require("fs");
  fs.writeFile("./data.txt", myJSON + `+${nextId}`, function (err) {
    if (err) {
      return console.log(err);
    }
  });
}
function readFile() {
  const fs = require("fs");
  fs.readFile("./data.txt", function (err, data) {
    if (err) {
      return console.error(err);
    }
    const jsonText = data.toString().split("+")[0];
    nextId = Number(data.toString().split("+")[1]);
    contacts = JSON.parse(jsonText);
  });
}

setInterval(() => {
  for (let el of pendingMap.keys()) {
    const timeNow = new Date();
    if (timeNow - pendingMap.get(el).payload.timeStart > 20000)
      pendingMap.delete(el);
  }
}, 10000);

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  try {
    if (msg.text == "Y" || msg.text == "N") {
      handleConfirmYesNo(msg);
      return;
    } else {
      handleRequest(msg);
      return;
    }
  } catch (error) {
    console.error(error);
    if (error instanceof ConflictException) {
      bot.sendMessage(chatId, error.message);
      return;
    } else if (error instanceof BadCommandException) {
      bot.sendMessage(chatId, error.message);
      return;
    }
    bot.sendMessage(chatId, "Server error. Try again!");
    return;
  }
});

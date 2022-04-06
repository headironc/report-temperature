const axios = require("axios");
const {readFile, writeFile} = require("fs/promises");
const fs = require("fs");

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getFormatDate = () => {
    const dateType = new Date();
    let month = dateType.getMonth() + 1;
    let day = dateType.getDate();
    let hour = dateType.getHours();
    let minute = dateType.getMinutes();
    let second = dateType.getSeconds();

    if (month >= 0 && month <= 9) month = "0" + month;
    if (day >= 0 && day <= 9) day = "0" + day;
    if (hour >= 0 && hour <= 9) hour = "0" + hour;
    if (minute >= 0 && minute <= 9) minute = "0" + minute;
    if (second >= 0 && second <= 9) second = "0" + second;

    return (dateType.getFullYear() + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second);
};

let options = {
    flags: "w", //
    encoding: "utf8", // utf8编码
};

let log = fs.createWriteStream(`${__dirname}/logs/${getFormatDate()}.log`, options);

// 创建logger
let logger = new console.Console(log);

const headers = (token) => {
    return {
        Host: "yqfk.mydongtai.cn:20443",
        "Content-Type": "application/json",
        "Accept-Language": "en-us",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 11_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E217 MicroMessenger/6.8.0(0x16080000) NetType/WIFI Language/en Branch/Br_trunk MiniProgramEnv/Mac",
        Authorization: `Bearer ${token}`,
        Referer: "https://servicewechat.com/wx6bb31cb552ea2792/23/page-frame.html",
    };
};

class ReportTemperature {
    constructor(username, password, token, name) {
        this.username = username;
        this.password = password;
        this.token = token;
        this.name = name;

        this.tokenIsChanged = false;

        this.id = undefined;
        this.phoneNumber = undefined;
        this.idCardNo = undefined;
        this.userType = undefined;
        this.nowDate = getFormatDate();
        this.temperature = "36." + getRandomInt(1, 5);
        this.symptom = "无";
        this.isChineseMedicine = "1";
        this.takeQuantity = 0;
        this.relationList = [];
        this.longitude = "120.37377166748047";
        this.latitude = "32.851959228515625";
    }

    async login(index) {
        const res = await axios.post("https://yqfk.mydongtai.cn:20443/appintf/login/loginUser.intf", {
            username: this.username, password: this.password,
        });

        logger.log(`${index}-${res?.data?.code} ${res?.data?.msg}---${this.name}---login--${getFormatDate()}`);

        this.tokenIsChanged = true;
        this.token = res.data.data?.token;
    }

    async getMsAndFamilyInfo(index) {
        if (!this.token) await this.login();

        let res = await axios.get("https://yqfk.mydongtai.cn:20443/appintf/tere/getMSAndFamilyInfo", {
            headers: headers(this.token),
        });

        logger.log(`${index}-${res?.data?.code} ${res?.data?.msg}---${this.name}---getMsAndFamilyInfo--${getFormatDate()}`);

        if (res?.data?.code === 401) {
            await this.login(index);

            res = await axios.get("https://yqfk.mydongtai.cn:20443/appintf/tere/temperReport.intf", {
                headers: headers(this.token),
            });

            logger.log(`${index}-${res?.data?.code} ${res?.data?.msg}---${this.name}---getMsAndFamilyInfo--when-failed--${getFormatDate()}`);
        }

        this.id = res?.data?.data?.id;
        this.name = this.name || res?.data?.data?.name;
        this.phoneNumber = res?.data?.data?.phoneNumber;
        this.idCardNo = res?.data?.data?.idCardNo;
        this.userType = res?.data?.data?.userType;

        let newRelationList = [];
        res?.data?.data?.relationList.forEach(({id, name}) => {
            const relationItem = {};
            relationItem.id = id;
            relationItem.name = name;
            relationItem.temperature = "36." + getRandomInt(1, 5);
            relationItem.symptom = "无";

            newRelationList.push(relationItem);
        });
        this.relationList = newRelationList;
    }

    users() {
        return {
            username: this.username,
            password: this.password,
            token: this.token,
            name: this.name,
            tokenIsChanged: this.tokenIsChanged,
        };
    }

    async report(index) {
        await this.getMsAndFamilyInfo(index);

        const data = {
            id: this.id,
            name: this.name,
            phoneNumber: this.phoneNumber,
            idCardNo: this.idCardNo,
            userType: this.userType,
            nowDate: this.nowDate,
            temperature: this.temperature,
            symptom: this.symptom,
            isChineseMedicine: this.isChineseMedicine,
            takeQuantity: this.takeQuantity,
            relationList: this.relationList,
            longitude: this.longitude,
            latitude: this.latitude,
        };

        const res = await axios.post("https://yqfk.mydongtai.cn:20443/appintf/tere/temperReport.intf", data, {
            headers: headers(this.token),
        });

        logger.log(`${index}-${res?.data?.code} ${res?.data?.msg}---${this.name}--report-temperature--${getFormatDate()}-${this.temperature}°C`);

        this.relationList.forEach(({name, temperature}) => {
            if (name) {
                logger.log(`${name}--${temperature}°C`);
            }
        });

        logger.log("");

        console.log(res.data, this.name);
    }
}

const getCredentials = async () => {
    return JSON.parse((await readFile(`${__dirname}/info.json`, "utf8")).toString());
};

const writeCredentials = async (obj) => {
    const buf = Buffer.from(JSON.stringify(obj));

    await writeFile(`${__dirname}/info.json`, buf);
};

const operate = async () => {
    const res = await getCredentials();

    const toWrited = {};
    for (const [index, {username, password, token, name}] of Object.values(res).entries()) {
        const user = new ReportTemperature(username, password, token, name);

        await user.report(index + 1);
        toWrited[`${user.name}`] = user.users();
    }

    const numberOfPeople = Object.keys(res).length;

    logger.log(`总人数： ${numberOfPeople}`);
    console.log(`总人数： ${numberOfPeople}`);

    for (const {tokenIsChanged} of Object.values(toWrited)) {
        if (tokenIsChanged) await writeCredentials(toWrited);
    }
};

operate();

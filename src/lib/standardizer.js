import * as XLSX from 'xlsx';
import { BANK_RULES } from './bankRules';

export const readExcel = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            if (!data) return reject(new Error("File error"));
            try {
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(json);
            } catch (err) {
                console.error("Error parsing excel", err);
                resolve([]);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsBinaryString(file);
    });
};

const normalizeDate = (raw) => {
    if (!raw) return '';
    if (typeof raw === 'number') {
        // Excel date conversion
        let date = new Date(Math.round((raw - 25569) * 86400 * 1000));
        // Check if valid date
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    }
    return String(raw).trim();
}

const parseNumber = (raw) => {
    if (!raw) return 0;
    if (typeof raw === 'number') return raw;
    const clean = String(raw).replace(/,/g, '').replace(/\s/g, '');
    return parseFloat(clean) || 0;
}

const detectBank = (rows) => {
    const safeRows = rows.filter(r => Array.isArray(r));
    const content = safeRows.slice(0, 10)
        .map(row => row.map(c => String(c || '').toLowerCase()).join(' '))
        .join(' ');

    for (const rule of BANK_RULES) {
        if (rule.keywords.some(k => content.includes(k.toLowerCase()))) {
            return rule;
        }
    }

    return BANK_RULES[0] || null; // Fallback to first rule
}

const getSafeHeader = (row) => {
    if (!row || !Array.isArray(row)) return [];
    return Array.from(row).map(c => (c !== null && c !== undefined) ? String(c).toLowerCase() : '');
}

export const processStatement = async (file) => {
    // Use local BANK_RULES instead of fetching
    const rules = BANK_RULES;

    let rows = await readExcel(file);
    if (!rows || !Array.isArray(rows) || rows.length === 0) return [];

    rows = rows.filter(r => Array.isArray(r));

    const bankRule = detectBank(rows);
    if (!bankRule) return [];

    const result = [];
    let headerRowIndex = -1;
    let map = {
        date: -1, desc: -1, withdrawal: -1, deposit: -1, balance: -1,
        relatedAccountName: -1, relatedAccount: -1, rate: -1
    };

    const findHeader = (keywords) => {
        return rows.findIndex(row => {
            const rowStr = Array.from(row).map(c => String(c || '').toLowerCase()).join(' ');
            return keywords.some(k => rowStr.includes(k.toLowerCase()));
        });
    };

    headerRowIndex = findHeader(bankRule.headerKeywords);
    if (headerRowIndex === -1) headerRowIndex = 0;

    const header = getSafeHeader(rows[headerRowIndex]);
    const mapping = bankRule.columnMapping;

    map = {
        date: header.findIndex(h => mapping.date?.some(k => h.includes(k))),
        desc: header.findIndex(h => mapping.desc?.some(k => h.includes(k))),
        withdrawal: header.findIndex(h => mapping.withdrawal?.some(k => h.includes(k))),
        deposit: header.findIndex(h => mapping.deposit?.some(k => h.includes(k))),
        balance: header.findIndex(h => mapping.balance?.some(k => h.includes(k))),
        relatedAccountName: header.findIndex(h => mapping.relatedAccountName?.some(k => h.includes(k))),
        relatedAccount: header.findIndex(h => mapping.relatedAccount?.some(k => h.includes(k))),
        rate: header.findIndex(h => mapping.rate?.some(k => h.includes(k))),
    };

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;

        if (map.date === -1 || !row[map.date]) continue;

        const dateVal = row[map.date];
        const normalizedDate = normalizeDate(dateVal);
        if (!normalizedDate || normalizedDate.length < 5) continue;

        const desc = (map.desc !== -1 && row[map.desc]) ? String(row[map.desc]) : '';
        const withdrawal = (map.withdrawal !== -1) ? parseNumber(row[map.withdrawal]) : 0;
        const deposit = (map.deposit !== -1) ? parseNumber(row[map.deposit]) : 0;
        const balance = (map.balance !== -1) ? parseNumber(row[map.balance]) : 0;

        const relatedAccountName = (map.relatedAccountName !== -1 && row[map.relatedAccountName]) ? String(row[map.relatedAccountName]) : '';
        const relatedAccount = (map.relatedAccount !== -1 && row[map.relatedAccount]) ? String(row[map.relatedAccount]) : '';
        const rate = (map.rate !== -1) ? parseNumber(row[map.rate]) : 0;

        const tx = {
            date: normalizedDate,
            description: desc,
            withdrawal,
            deposit,
            balance,
            relatedAccountName,
            relatedAccount,
            rate,
            bankName: bankRule.name
        };

        // Skip total rows
        if (tx.description.toLowerCase().includes('total') || tx.description.toLowerCase().includes('нийт')) continue;
        result.push(tx);
    }

    return result;
}

export const exportToAndDownloadExcel = (transactions) => {
    // Default headers since we don't have settings API yet
    const headers = {
        date: 'Date',
        description: 'Description',
        withdrawal: 'Withdrawal',
        deposit: 'Deposit',
        balance: 'Balance',
        relatedAccountName: 'Related Account Name',
        relatedAccount: 'Related Account',
        rate: 'Rate',
        bankName: 'Bank'
    };

    const mappedData = transactions.map(tx => {
        const newRow = {};
        newRow[headers.date] = tx.date;
        newRow[headers.description] = tx.description;
        newRow[headers.withdrawal] = tx.withdrawal;
        newRow[headers.deposit] = tx.deposit;
        newRow[headers.balance] = tx.balance;
        newRow[headers.relatedAccountName] = tx.relatedAccountName;
        newRow[headers.relatedAccount] = tx.relatedAccount;
        newRow[headers.rate] = tx.rate;
        newRow[headers.bankName] = tx.bankName;
        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(mappedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, "Standardized_Statement.xlsx");
}

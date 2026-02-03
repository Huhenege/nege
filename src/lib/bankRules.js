export const BANK_RULES = [
    {
        "id": "KHAN",
        "name": "Khan Bank (Хаан Банк)",
        "keywords": [
            "khan bank",
            "хаан банк"
        ],
        "headerKeywords": [
            "Гүйлгээний огноо",
            "Transaction Date"
        ],
        "columnMapping": {
            "date": [
                "огноо",
                "date"
            ],
            "desc": [
                "утга",
                "description"
            ],
            "withdrawal": [
                "зарлага",
                "debit",
                "withdrawal"
            ],
            "deposit": [
                "орлого",
                "credit",
                "deposit"
            ],
            "balance": [
                "үлдэгдэл",
                "balance"
            ],
            "relatedAccountName": [
                "харилцагч",
                "recipient",
                "харилцсан дансны нэр"
            ],
            "relatedAccount": [
                "харилцсан данс",
                "account number",
                "account"
            ],
            "rate": [
                "ханш",
                "rate"
            ]
        }
    },
    {
        "id": "GOLOMT",
        "name": "Golomt Bank (Голомт Банк)",
        "keywords": [
            "golomt",
            "голомт"
        ],
        "headerKeywords": [
            "Гүйлгээний огноо",
            "Transaction Date",
            "Date",
            "Огноо"
        ],
        "columnMapping": {
            "date": [
                "огноо",
                "date"
            ],
            "desc": [
                "гүйлгээний утга",
                "description"
            ],
            "withdrawal": [
                "зарлага",
                "debit"
            ],
            "deposit": [
                "орлого",
                "credit"
            ],
            "balance": [
                "үлдэгдэл",
                "balance"
            ],
            "relatedAccountName": [
                "харилцагч",
                "нэр"
            ],
            "relatedAccount": [
                "харилцсан данс",
                "данс"
            ],
            "rate": [
                "ханш",
                "валютын ханш"
            ]
        }
    }
];

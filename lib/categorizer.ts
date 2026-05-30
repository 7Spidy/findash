interface CategoryRule {
  pattern: RegExp
  category: string
  subcategory: string
}

const CATEGORY_RULES: CategoryRule[] = [
  { pattern: /swiggy|zomato/i,              category: 'Food & Dining',   subcategory: 'Delivery'   },
  { pattern: /blinkit|bigbasket|zepto|dmart/i, category: 'Food & Dining', subcategory: 'Groceries' },
  { pattern: /ola|uber/i,                   category: 'Transport',       subcategory: 'Cab'        },
  { pattern: /indian oil|hpcl|bpcl|petrol|fuel/i, category: 'Transport', subcategory: 'Fuel'       },
  { pattern: /fastag/i,                     category: 'Transport',       subcategory: 'Toll'       },
  { pattern: /amazon/i,                     category: 'Shopping',        subcategory: 'General'    },
  { pattern: /flipkart|myntra|ajio|nykaa/i, category: 'Shopping',        subcategory: 'General'    },
  { pattern: /netflix/i,                    category: 'Entertainment',   subcategory: 'OTT'        },
  { pattern: /spotify/i,                    category: 'Entertainment',   subcategory: 'Music'      },
  { pattern: /hotstar|prime video/i,        category: 'Entertainment',   subcategory: 'OTT'        },
  { pattern: /youtube premium/i,            category: 'Entertainment',   subcategory: 'OTT'        },
  { pattern: /bookmyshow/i,                 category: 'Entertainment',   subcategory: 'Events'     },
  { pattern: /notion|github|perplexity|chatgpt|adobe|icloud/i, category: 'Subscriptions', subcategory: 'SaaS' },
  { pattern: /jio|airtel|bsnl/i,            category: 'Utilities',       subcategory: 'Mobile'     },
  { pattern: /msedcl|electricity|mahagas/i, category: 'Utilities',       subcategory: 'Bills'      },
  { pattern: /irctc|makemytrip|cleartrip|oyo|booking/i, category: 'Travel', subcategory: 'General' },
  { pattern: /zerodha|groww|coin/i,         category: 'Investments',     subcategory: 'Stocks'     },
  { pattern: /apollo|pharmeasy|1mg|cult/i,  category: 'Health',          subcategory: 'General'    },
]

export function categorize(merchantName: string): { category: string; subcategory: string } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(merchantName)) {
      return { category: rule.category, subcategory: rule.subcategory }
    }
  }
  return { category: 'Others', subcategory: 'General' }
}

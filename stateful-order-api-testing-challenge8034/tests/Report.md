
### نتایج تست‌ها

| ID | سناریو | دسته | نتیجه | انتظار / واقعیت خلاصه |
|---|---|---|---|---|
| `TC-AUTH-01` | POST /api/login — valid Alice login | positive | **PASSED** | 200 with token / 200; token returned |
| `TC-AUTH-02` | POST /api/login — valid Bob login | positive | **PASSED** | 200 with token / 200; token returned |

| `TC-ORD-01` | POST /api/order — Alice spends 30 | positive | **PASSED** | 201; orderId and newCredit=70 / 201; orderId=ord-a100, newCredit=70 |
| `TC-ORD-02` | POST /api/order — spend exact remaining 70 | boundary | **PASSED** | 201; orderId and newCredit=0 / 201; orderId=ord-a101, newCredit=0 |

| `TC-LST-01` | GET /api/orders — query-token contract for Alice | contract_bug | **FAILED** | 200 with orders array containing Alice orders / 401 Invalid token |
| `TC-LST-02` | GET /api/orders — invalid query token | negative | **PASSED** | 401 Invalid token / 401 Invalid token |
| `TC-CNC-01` | POST /api/order/cancel — cancel pending order; refund | stateful | **PASSED** | 200; cancelled; newCredit=70 / 200; cancelled; newCredit=70 |
| `TC-CNC-02` | POST /api/order/cancel — repeat cancellation | stateful | **PASSED** | 409 Order cannot be cancelled / 409 Order cannot be cancelled |

| `TC-CMP-01` | POST /api/order/complete — complete pending order | stateful | **PASSED** | 200; status=completed / 200; status=completed |
| `TC-CMP-02` | POST /api/order/cancel — cancel completed order | stateful | **PASSED** | 409 Order cannot be cancelled / 409 Order cannot be cancelled |



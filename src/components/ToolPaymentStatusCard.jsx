import React from 'react';
import './ToolPaymentStatusCard.css';

const formatMoney = (value) => `${Number(value || 0).toLocaleString()}₮`;

const getStatusMeta = ({ isToolActive, paymentReady, paymentUsed }) => {
    if (!isToolActive) {
        return { label: 'Түр хаалттай', tone: 'badge-warning' };
    }
    if (paymentReady) {
        return { label: 'Идэвхтэй', tone: 'badge-success' };
    }
    if (paymentUsed) {
        return { label: 'Ашигласан', tone: 'badge-muted' };
    }
    return { label: 'Төлбөр шаардлагатай', tone: 'badge-warning' };
};

function ToolPaymentStatusCard({
    className = '',
    isToolActive = true,
    paymentReady = false,
    paymentUsed = false,
    discountedPrice = 0,
    creditCost = 1,
    onOpenPayment,
    onResetPayment,
    payButtonLabel = 'Төлбөр сонгох',
    resetButtonLabel = 'Дахин төлөх',
    creditBalanceLabel = null,
}) {
    const statusMeta = getStatusMeta({ isToolActive, paymentReady, paymentUsed });

    return (
        <section className={`card tps-card ${className}`.trim()}>
            <div className="card-header">
                <div className="card-title">Төлбөрийн эрх</div>
                <span className={`badge ${statusMeta.tone}`}>{statusMeta.label}</span>
            </div>
            <div className="card-body tps-body">
                <div className="tps-row">
                    <div>
                        <p className="tps-label">Нэг удаагийн ашиглалт</p>
                        <p className="tps-price">{formatMoney(discountedPrice)}</p>
                        <p className="tps-sub">эсвэл {creditCost} credit</p>
                        {creditBalanceLabel ? (
                            <p className="tps-balance">Credits үлдэгдэл: <strong>{creditBalanceLabel}</strong></p>
                        ) : null}
                    </div>
                    {paymentReady ? (
                        <button type="button" className="btn btn-ghost" onClick={onResetPayment}>
                            {resetButtonLabel}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary" onClick={onOpenPayment} disabled={!isToolActive}>
                            {payButtonLabel}
                        </button>
                    )}
                </div>

                {paymentReady ? (
                    <div className="alert alert-success tps-alert">1 удаагийн эрх идэвхтэй байна.</div>
                ) : null}

                {paymentUsed ? (
                    <div className="alert tps-alert tps-alert--muted">Энэ эрх ашиглагдсан байна. Дахин төлбөр сонгоно уу.</div>
                ) : null}

                {!isToolActive ? (
                    <div className="alert alert-warning tps-alert">Энэ үйлчилгээ одоогоор түр хаалттай байна.</div>
                ) : null}
            </div>
        </section>
    );
}

export default ToolPaymentStatusCard;

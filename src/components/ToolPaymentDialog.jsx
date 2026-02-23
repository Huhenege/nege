import React from 'react';
import './ToolPaymentDialog.css';

const formatMoney = (value) => `${Number(value || 0).toLocaleString()}₮`;

function ToolPaymentDialog({
    open,
    title = 'Төлбөрийн сонголт',
    onClose,
    discountedPrice = 0,
    creditCost = 1,
    paymentMethod = 'pay',
    onPaymentMethodChange,
    onCreateInvoice,
    onConsumeCredits,
    onCheckPayment,
    paymentStatus = 'idle',
    paymentInvoice = null,
    isCheckingPayment = false,
    paymentError = null,
    isToolActive = true,
    currentUser = null,
    creditBalance = null,
    requireLoginForCredits = true,
    isAdminFree = false,
    onAdminContinue,
}) {
    if (!open) return null;

    const canUseCredits = !requireLoginForCredits || !!currentUser;
    const isBusy = paymentStatus === 'creating' || isCheckingPayment;
    const primaryDisabled = isBusy || !isToolActive || (paymentMethod === 'credits' && !canUseCredits);
    const checkDisabled = !paymentInvoice?.invoice_id || isCheckingPayment || !isToolActive;

    return (
        <div
            className="tpd-backdrop"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose?.();
                }
            }}
        >
            <div className="tpd-modal">
                <div className="tpd-header">
                    <h3>{title}</h3>
                    <button type="button" onClick={onClose}>
                        Хаах
                    </button>
                </div>

                {isAdminFree ? (
                    <>
                        <p className="tpd-price">
                            Үнэгүй
                            <span>Admin эрхтэй хэрэглэгч</span>
                        </p>
                        <div className="tpd-admin-note">
                            Төлбөр шаардахгүй. Шууд үргэлжлүүлэх боломжтой.
                        </div>
                        <div className="tpd-actions">
                            <button
                                type="button"
                                className="tpd-btn tpd-btn--primary"
                                onClick={onAdminContinue || onClose}
                            >
                                Үргэлжлүүлэх
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="tpd-price">
                            {formatMoney(discountedPrice)}
                            <span>эсвэл {creditCost} credit</span>
                        </p>

                        <div className="tpd-methods">
                            <button
                                type="button"
                                className={paymentMethod === 'pay' ? 'active' : ''}
                                onClick={() => onPaymentMethodChange?.('pay')}
                                disabled={!isToolActive}
                            >
                                QPay
                            </button>
                            <button
                                type="button"
                                className={paymentMethod === 'credits' ? 'active' : ''}
                                onClick={() => onPaymentMethodChange?.('credits')}
                                disabled={!isToolActive}
                            >
                                Credits
                            </button>
                        </div>

                        <div className="tpd-actions">
                            <button
                                type="button"
                                className="tpd-btn tpd-btn--primary"
                                onClick={paymentMethod === 'credits' ? onConsumeCredits : onCreateInvoice}
                                disabled={primaryDisabled}
                            >
                                {paymentStatus === 'creating'
                                    ? 'Бэлтгэж байна...'
                                    : paymentMethod === 'credits'
                                        ? 'Credits ашиглах'
                                        : 'QPay QR үүсгэх'}
                            </button>
                            {paymentMethod === 'pay' && (
                                <button
                                    type="button"
                                    className="tpd-btn tpd-btn--outline"
                                    onClick={onCheckPayment}
                                    disabled={checkDisabled}
                                >
                                    {isCheckingPayment ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                </button>
                            )}
                        </div>

                        {paymentMethod === 'pay' ? (
                            <div className="tpd-qr">
                                {paymentInvoice?.qr_image ? (
                                    <img src={`data:image/png;base64,${paymentInvoice.qr_image}`} alt="QPay QR" />
                                ) : (
                                    <div className="tpd-placeholder">QPay QR энд гарна</div>
                                )}
                            </div>
                        ) : (
                            <div className="tpd-credits">
                                <div className="tpd-credits-row">
                                    <span>Credits үлдэгдэл</span>
                                    <strong>
                                        {typeof creditBalance === 'number' ? creditBalance.toLocaleString() : (currentUser ? '-' : 'Нэвтэрч харах')}
                                    </strong>
                                </div>
                                <div className="tpd-credits-row">
                                    <span>Зарцуулалт</span>
                                    <strong>{creditCost} credit</strong>
                                </div>
                                {!canUseCredits && (
                                    <p className="tpd-hint">Credits ашиглахын тулд нэвтэрнэ үү.</p>
                                )}
                            </div>
                        )}

                        {paymentMethod === 'pay' && Array.isArray(paymentInvoice?.urls) && paymentInvoice.urls.length > 0 && (
                            <div className="tpd-banks">
                                <p className="tpd-banks-label">Банкны апп-аар төлөх:</p>
                                <div className="tpd-banks-grid">
                                    {paymentInvoice.urls.map((bank, index) => (
                                        <a key={`${bank?.name || 'bank'}-${index}`} href={bank.link} className="tpd-bank-item" title={bank.description}>
                                            <span>{bank.description || bank.name || 'Bank'}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {paymentError && <p className="tpd-error">{paymentError}</p>}
            </div>
        </div>
    );
}

export default ToolPaymentDialog;

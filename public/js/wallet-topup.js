(function(){
  const form = document.getElementById('topup-form');
  if (!form) return;

  const amountInput = document.getElementById('topup-amount');
  const errBox = document.getElementById('topup-error');
  const balanceEl = document.getElementById('wallet-balance');

  function showErr(msg){
    errBox.textContent = msg || 'Something went wrong';
    errBox.style.display = 'block';
  }
  function clearErr(){
    errBox.textContent = '';
    errBox.style.display = 'none';
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    clearErr();
    const value = Number(amountInput.value);
    if (!Number.isFinite(value) || value < 1) {
      showErr('Enter a valid amount (minimum ₹1)');
      return;
    }

    try {
      const initResp = await fetch('/wallet/topup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value })
      }).then(r => r.json());

      if (!initResp.success) {
        showErr(initResp.message || 'Failed to initiate top-up');
        return;
      }

      const options = {
        key: initResp.keyId,
        amount: initResp.amount,
        currency: initResp.currency,
        name: 'Wallet Top-up',
        description: 'Add money to wallet',
        order_id: initResp.razorpayOrderId,
        handler: async function (response) {
          try {
            const verifyResp = await fetch('/wallet/topup/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            }).then(r => r.json());

            if (verifyResp.success) {
              if (balanceEl) balanceEl.textContent = Number(verifyResp.balance).toLocaleString();
              amountInput.value = '';
              alert('Top-up successful');
            } else {
              showErr(verifyResp.message || 'Top-up verification failed');
            }
          } catch (err) {
            console.log(err);
            showErr('Verification error');
          }
        },
        theme: { color: '#3399cc' }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response){
        showErr(response.error?.description || 'Payment failed');
      });
      rzp.open();
    } catch (err) {
      console.error(err)
      showErr('Failed to initiate Razorpay');
    }
  });
})();

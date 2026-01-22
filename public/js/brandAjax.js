
let currentPage = 1;
let currentSearch = '';


document.addEventListener('DOMContentLoaded', function() {
    initializeBrandManagement();
    checkUrlMessages();
});

function initializeBrandManagement() {

    const urlParams = new URLSearchParams(window.location.search);
    currentPage = parseInt(urlParams.get('page')) || 1;
    currentSearch = urlParams.get('search') || '';


    setupSearchForm();
    setupPaginationLinks();
    setupClearSearch();
}


function setupSearchForm() {
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const searchValue = document.getElementById('searchInput').value.trim();
            loadBrands(1, searchValue);
        });
    }
}


function setupClearSearch() {
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            document.getElementById('searchInput').value = '';
            loadBrands(1, '');
        });
    }
}


function setupPaginationLinks() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('.page-link-brand')) {
            e.preventDefault();
            const link = e.target.closest('.page-link-brand');
            const href = link.getAttribute('href');
            
            if (href && href !== '#' && !link.closest('.page-item-brand.disabled')) {
                const urlParams = new URLSearchParams(href.split('?')[1]);
                const page = parseInt(urlParams.get('page')) || 1;
                const search = urlParams.get('search') || '';
                loadBrands(page, search);
            }
        }
    });
}

async function loadBrands(page, search) {
    try {

        showLoadingState();


        const url = `/admin/brands?page=${page}${search ? '&search=' + encodeURIComponent(search) : ''}`;

  
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load brands');
        }

        const html = await response.text();
        
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        
        updateStats(doc);

       
        updateBrandsGrid(doc);

    
        updatePagination(doc);

       
        updateHeaderCounts(doc);

 
        currentPage = page;
        currentSearch = search;
        window.history.pushState({}, '', url);

    
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error loading brands:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: 'Failed to load brands. Please try again.',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        hideLoadingState();
    }
}


function showLoadingState() {
    const brandsGrid = document.getElementById('brandsGrid');
    if (brandsGrid) {
        brandsGrid.innerHTML = `
            <div class="loading-state-brand">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading brands...</p>
            </div>
        `;
        brandsGrid.style.gridColumn = '1 / -1';
    }
}


function hideLoadingState() {
    const brandsGrid = document.getElementById('brandsGrid');
    if (brandsGrid) {
        brandsGrid.style.gridColumn = '';
    }
}


function updateStats(doc) {
    const totalCount = doc.getElementById('totalBrandsCount');
    const activeCount = doc.getElementById('activeBrandsCount');
    const blockedCount = doc.getElementById('blockedBrandsCount');

    if (totalCount) {
        animateCount('totalBrandsCount', parseInt(totalCount.textContent));
    }
    if (activeCount) {
        animateCount('activeBrandsCount', parseInt(activeCount.textContent));
    }
    if (blockedCount) {
        animateCount('blockedBrandsCount', parseInt(blockedCount.textContent));
    }
}


function animateCount(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;
    const duration = 500;
    const steps = 20;
    const stepValue = (newValue - currentValue) / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;

    const interval = setInterval(() => {
        currentStep++;
        const value = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = value;

        if (currentStep >= steps) {
            element.textContent = newValue;
            clearInterval(interval);
        }
    }, stepDuration);
}


function updateBrandsGrid(doc) {
    const newGrid = doc.getElementById('brandsGrid');
    const currentGrid = document.getElementById('brandsGrid');

    if (newGrid && currentGrid) {
        currentGrid.innerHTML = newGrid.innerHTML;
    }
}


function updatePagination(doc) {
    const newPagination = doc.getElementById('paginationWrapper');
    const currentPagination = document.getElementById('paginationWrapper');

    if (newPagination && currentPagination) {
        currentPagination.innerHTML = newPagination.innerHTML;
    } else if (!newPagination && currentPagination) {
        currentPagination.style.display = 'none';
    } else if (newPagination && !currentPagination) {
        
        const paginationParent = document.querySelector('.professional-card-brand');
        if (paginationParent) {
            paginationParent.innerHTML += newPagination.outerHTML;
        }
    }
}


function updateHeaderCounts(doc) {
    const newShowingCount = doc.getElementById('showingCount');
    const newRecordsBadge = doc.getElementById('recordsBadge');

    if (newShowingCount) {
        const currentShowingCount = document.getElementById('showingCount');
        if (currentShowingCount) {
            currentShowingCount.textContent = newShowingCount.textContent;
        }
    }

    if (newRecordsBadge) {
        const currentRecordsBadge = document.getElementById('recordsBadge');
        if (currentRecordsBadge) {
            currentRecordsBadge.innerHTML = newRecordsBadge.innerHTML;
        }
    }
}

async function blockBrandAjax(brandId, brandName) {
    const result = await Swal.fire({
        title: 'Block Brand?',
        html: `Are you sure you want to block <strong>${brandName}</strong>?<br><small>This brand will be hidden from users.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-ban me-2"></i>Yes, Block it!',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Blocking Brand...',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`/admin/blockBrand?id=${brandId}&page=${currentPage}`, {
                method: 'PATCH',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await loadBrands(currentPage, currentSearch);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Brand Blocked!',
                    text: 'The brand has been blocked successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Failed to block brand');
            }
        } catch (_error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to block brand. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}

async function unblockBrandAjax(brandId, brandName) {
    const result = await Swal.fire({
        title: 'Unblock Brand?',
        html: `Are you sure you want to unblock <strong>${brandName}</strong>?<br><small>This brand will be visible to users again.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-check-circle me-2"></i>Yes, Unblock it!',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Unblocking Brand...',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`/admin/unBlockBrand?id=${brandId}&page=${currentPage}`, {
                method: 'PATCH',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await loadBrands(currentPage, currentSearch);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Brand Unblocked!',
                    text: 'The brand has been unblocked successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Failed to unblock brand');
            }
        } catch (error) {
            console.log(error);
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to unblock brand. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}


async function deleteBrandAjax(brandId, brandName) {
    const result = await Swal.fire({
        title: 'Delete Brand?',
        html: `Are you sure you want to delete <strong>${brandName}</strong>?<br><small class="text-danger">⚠️ This action cannot be undone!</small>`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-trash-alt me-2"></i>Yes, Delete it!',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
        reverseButtons: true,
        footer: '<span style="color: #ef4444;">⚠️ Warning: All products associated with this brand may be affected.</span>'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Deleting Brand...',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`/admin/deleteBrand?id=${brandId}&page=${currentPage}`, {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await loadBrands(currentPage, currentSearch);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Brand Deleted!',
                    text: 'The brand has been deleted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Failed to delete brand');
            }
        } catch (_error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to delete brand. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}

function checkUrlMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const action = urlParams.get('action');

    if (status === 'success' && action) {
        let title = 'Success!';
        let message = '';
        
        switch(action) {
            case 'blocked':
                title = 'Brand Blocked!';
                message = 'The brand has been blocked successfully.';
                break;
            case 'unblocked':
                title = 'Brand Unblocked!';
                message = 'The brand has been unblocked successfully.';
                break;
            case 'deleted':
                title = 'Brand Deleted!';
                message = 'The brand has been deleted successfully.';
                break;
        }

        Swal.fire({
            icon: 'success',
            title: title,
            text: message,
            timer: 2000,
            showConfirmButton: false
        });

        const cleanUrl = window.location.pathname + (currentSearch ? `?search=${currentSearch}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

window.blockBrandAjax = blockBrandAjax;
window.unblockBrandAjax = unblockBrandAjax;
window.deleteBrandAjax = deleteBrandAjax;

window.addEventListener('popstate', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;
    const search = urlParams.get('search') || '';
    loadBrands(page, search);
});

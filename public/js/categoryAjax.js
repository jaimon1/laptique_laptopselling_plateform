
let currentPage = 1;
let currentSearch = '';


document.addEventListener('DOMContentLoaded', function() {
    initializeCategoryManagement();
});

function initializeCategoryManagement() {
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
            loadCategories(1, searchValue);
        });
    }
}


function setupClearSearch() {
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            document.getElementById('searchInput').value = '';
            loadCategories(1, '');
        });
    }
}


function setupPaginationLinks() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('.page-link-category')) {
            e.preventDefault();
            const link = e.target.closest('.page-link-category');
            const href = link.getAttribute('href');
            
            if (href && href !== '#' && !link.closest('.page-item-category.disabled')) {
                const urlParams = new URLSearchParams(href.split('?')[1]);
                const page = parseInt(urlParams.get('page')) || 1;
                const search = urlParams.get('search') || '';
                loadCategories(page, search);
            }
        }
    });
}


async function loadCategories(page, search) {
    try {
    
        showLoadingState();

        const url = `/admin/category?page=${page}${search ? '&search=' + encodeURIComponent(search) : ''}`;

        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load categories');
        }

        const html = await response.text();
        
   
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        
        updateStats(doc);


        updateCategoriesGrid(doc);


        updatePagination(doc);

   
        updateHeaderCounts(doc);

 
        currentPage = page;
        currentSearch = search;
        window.history.pushState({}, '', url);

  
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error loading categories:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: 'Failed to load categories. Please try again.',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        hideLoadingState();
    }
}


function showLoadingState() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    if (categoriesGrid) {
        categoriesGrid.innerHTML = `
            <div class="loading-state-category">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading categories...</p>
            </div>
        `;
        categoriesGrid.style.gridColumn = '1 / -1';
    }
}


function hideLoadingState() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    if (categoriesGrid) {
        categoriesGrid.style.gridColumn = '';
    }
}

function updateStats(doc) {
    const totalCount = doc.getElementById('totalCategoriesCount');
    const listedCount = doc.getElementById('listedCategoriesCount');
    const unlistedCount = doc.getElementById('unlistedCategoriesCount');

    if (totalCount) {
        animateCount('totalCategoriesCount', parseInt(totalCount.textContent));
    }
    if (listedCount) {
        animateCount('listedCategoriesCount', parseInt(listedCount.textContent));
    }
    if (unlistedCount) {
        animateCount('unlistedCategoriesCount', parseInt(unlistedCount.textContent));
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


function updateCategoriesGrid(doc) {
    const newGrid = doc.getElementById('categoriesGrid');
    const currentGrid = document.getElementById('categoriesGrid');

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
        const paginationParent = document.querySelector('.professional-card-category');
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


async function listCategoryAjax(categoryId, categoryName) {
    const result = await Swal.fire({
        title: 'List Category?',
        html: `Are you sure you want to list <strong>${categoryName}</strong>?<br><small>This category will be visible to users.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-eye me-2"></i>Yes, List it!',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Listing Category...',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`/admin/unList?id=${categoryId}&page=${currentPage}`, {
                method: 'PATCH',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await loadCategories(currentPage, currentSearch);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Category Listed!',
                    text: 'The category has been listed successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Failed to list category');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to list category. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}


async function unlistCategoryAjax(categoryId, categoryName) {
    const result = await Swal.fire({
        title: 'Unlist Category?',
        html: `Are you sure you want to unlist <strong>${categoryName}</strong>?<br><small>This category will be hidden from users.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-eye-slash me-2"></i>Yes, Unlist it!',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Unlisting Category...',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`/admin/List?id=${categoryId}&page=${currentPage}`, {
                method: 'PATCH',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await loadCategories(currentPage, currentSearch);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Category Unlisted!',
                    text: 'The category has been unlisted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Failed to unlist category');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to unlist category. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}


async function deleteCategoryAjax(categoryId, categoryName) {
    const result = await Swal.fire({
        title: 'Delete Category?',
        html: `Are you sure you want to delete <strong>${categoryName}</strong>?<br><small class="text-danger">⚠️ This action cannot be undone!</small>`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-trash-alt me-2"></i>Yes, Delete it!',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Cancel',
        reverseButtons: true,
        footer: '<span style="color: #ef4444;">⚠️ Warning: All products in this category may be affected.</span>'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Deleting Category...',
                html: 'Please wait...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`/admin/deleteCategory?id=${categoryId}&page=${currentPage}`, {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await loadCategories(currentPage, currentSearch);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Category Deleted!',
                    text: 'The category has been deleted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('Failed to delete category');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to delete category. Please try again.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}


window.addEventListener('popstate', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;
    const search = urlParams.get('search') || '';
    loadCategories(page, search);
});

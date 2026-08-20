$envs = @("production", "preview")

$vars = @{
    "PLATFORM_WA_PHONE_NUMBER_ID" = "1137829762755843"
    "PLATFORM_WA_ACCESS_TOKEN" = "EAGFHu8tq1vgBSOR4nzpHbMya1LV2gPFJFcKkN7JHUkcZBaskOs4cOKR6iCsxmZA5SgSJKLS1ZB2GVkuMN7JFWtE1c8aa7ohVO6TA0ZBrd0mcUkDypB4IJqm2hlTUZAtU8dot4MqSrzITOvpGyWXoKBM0mjtga3vt5KvcaKx45UQ1qB8wuqZBp63hK7jm0Lk2okgUOjjrw84F6z9JtqsZAZB8PgE2O8qSzwZArDA1tNDb0gfwiPqRS3jz2zNAxxZBtG6z2o5bTskF3mfRXE28hLb4OG"
    "PLATFORM_WA_APP_SECRET" = "0658f1d976f468e6db727fb2d8b107aa"
    "PLATFORM_WA_VERIFY_TOKEN" = "acuity_wa_verify_13ea5abb88a99425"
    "ENCRYPTION_KEY" = "d7ec81f4ed5074f7d66fff8bea258df75d9ef15a85dceb2d826e8b93ff5cd400"
    "CRON_SECRET" = "f260cfb06e2267752715eff0a655d275855ed752990c3f19"
}

Write-Host "Updating Vercel Environment Variables..."

foreach ($key in $vars.Keys) {
    foreach ($env in $envs) {
        Write-Host "Setting $key in $env..."
        npx vercel env add $key $env --value $vars[$key] --force --yes
    }
}

Write-Host "All variables updated! Redeploying to production..."
npx vercel --prod --yes
